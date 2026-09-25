/**
 * Multi-frame zstd decompression for DSH session archives.
 *
 * G4 evidence (reports/g2-g3-g4-evidence.md): Node's
 * `zlib.zstdDecompressSync` silently decompresses ONLY THE FIRST FRAME of a
 * concatenated multi-frame buffer — a whole-file call under-counts usage
 * without any error. Session archives are appended frame-by-frame, so this
 * module walks frame boundaries from the frame header itself and
 * decompresses each frame separately.
 *
 * Frame layout per RFC 8878: magic(4) · Frame_Header_Descriptor(1) ·
 * [window descriptor(1)] · [dictionary id(0/1/2/4)] · [content size
 * (0/1/2/4/8)] · blocks(3-byte header + payload each until last_block) ·
 * [content checksum(4)].
 */
import zlib from 'node:zlib';

/** Zstandard frame magic, little-endian (28 B5 2F FD). */
export const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/**
 * Byte length of one complete zstd frame starting at `off`.
 * @throws when the magic is missing at `off` or the header runs past the buffer.
 */
export function zstdFrameLength(buf: Buffer, off: number): number {
	if (off + 4 > buf.length || !buf.subarray(off, off + 4).equals(ZSTD_MAGIC)) {
		const got = buf.subarray(off, Math.min(off + 8, buf.length)).toString('hex');
		throw new Error(`zstd frame magic expected at offset ${off}, got bytes ${got}`);
	}
	let p = off + 4;
	const fhd = buf[p++];
	const fcsCode = fhd >> 6;
	const singleSegment = (fhd >> 5) & 1;
	const checksum = (fhd >> 2) & 1;
	const dictCode = fhd & 3;
	if (!singleSegment) p += 1;
	p += [0, 1, 2, 4][dictCode];
	let fcsBytes = [0, 2, 4, 8][fcsCode];
	if (fcsCode === 0 && singleSegment) fcsBytes = 1;
	p += fcsBytes;
	for (;;) {
		if (p + 3 > buf.length) throw new Error(`zstd block header at offset ${p} runs past buffer end (offset ${off} frame)`);
		const h = buf.readUIntLE(p, 3);
		const last = h & 1;
		const size = h >>> 3;
		p += 3 + size;
		if (last) break;
	}
	if (checksum) p += 4;
	return p - off;
}

/** Decompress every frame in `buf`, returning the concatenated payload. */
export function zstdDecompressAll(buf: Buffer): Buffer {
	const parts: Buffer[] = [];
	let off = 0;
	while (off < buf.length) {
		const len = zstdFrameLength(buf, off);
		parts.push(zlib.zstdDecompressSync(buf.subarray(off, off + len)));
		off += len;
	}
	return Buffer.concat(parts);
}

/**
 * Decompress frames covering `[from, to)` of `buf` (incremental scanning:
 * appended frames start where the previous watermark's size ended).
 * @throws when `from` does not land on a frame boundary (magic mismatch).
 */
export function zstdDecompressRange(buf: Buffer, from: number, to: number): Buffer {
	if (from < 0 || to > buf.length || from >= to) {
		throw new Error(`zstdDecompressRange: invalid range [${from}, ${to}) for buffer length ${buf.length}`);
	}
	const parts: Buffer[] = [];
	let off = from;
	while (off < to) {
		const len = zstdFrameLength(buf, off);
		if (off + len > to) {
			throw new Error(`zstd frame at offset ${off} (length ${len}) crosses range end ${to} — incomplete frame`);
		}
		parts.push(zlib.zstdDecompressSync(buf.subarray(off, off + len)));
		off += len;
	}
	return Buffer.concat(parts);
}
