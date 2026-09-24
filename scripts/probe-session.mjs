/**
 * Session archive probe — evidence collector for G4 (zstd under this Node)
 * and for the real line schema. Read-only against DSH_HOME.
 *
 * Usage: node --import ./tests/ts-alias.mjs scripts/probe-session.mjs <file.zstd> [more files...]
 * (the bare `node scripts/probe-session.mjs` form cannot resolve the .js→.ts alias)
 */
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/** Parse one zstd frame header starting at `off`; return its total byte length. */
function zstdFrameLength(buf, off) {
	let p = off + 4; // skip magic
	const fhd = buf[p++];
	const fcsCode = fhd >> 6;
	const singleSegment = (fhd >> 5) & 1;
	const checksum = (fhd >> 2) & 1;
	const dictCode = fhd & 3;
	if (!singleSegment) p += 1; // window descriptor
	p += [0, 1, 2, 4][dictCode];
	let fcsBytes = [0, 2, 4, 8][fcsCode];
	if (fcsCode === 0 && singleSegment) fcsBytes = 1;
	p += fcsBytes;
	for (;;) {
		const h = buf.readUIntLE(p, 3);
		const last = h & 1;
		const size = h >>> 3;
		p += 3 + size;
		if (last) break;
	}
	if (checksum) p += 4;
	return p - off;
}

function decompressAll(buf) {
	const frames = [];
	let off = 0;
	const parts = [];
	while (off < buf.length) {
		if (buf.length - off < 4 || !buf.subarray(off, off + 4).equals(MAGIC)) {
			throw new Error(`no frame magic at offset ${off} (bytes: ${buf.subarray(off, off + 8).toString('hex')})`);
		}
		const len = zstdFrameLength(buf, off);
		frames.push(len);
		parts.push(zlib.zstdDecompressSync(buf.subarray(off, off + len)));
		off += len;
	}
	return { frames, text: Buffer.concat(parts).toString('utf8') };
}

function analyze(file) {
	const buf = readFileSync(file);
	const { frames, text } = decompressAll(buf);
	const lines = text.split('\n').filter(l => l.trim().length > 0);
	console.log(`${file}`);
	console.log(`  bytes=${buf.length} frames=${frames.length} lines=${lines.length}`);
	const types = new Map();
	for (const l of lines) {
		const o = JSON.parse(l);
		types.set(o.type, (types.get(o.type) ?? 0) + 1);
	}
	console.log(`  types=${JSON.stringify(Object.fromEntries(types))}`);
	const header = JSON.parse(lines[0]);
	if (header.type !== 'session') throw new Error(`${file}: first line type=${header.type}, expected session`);
	const slimHeader = { ...header };
	delete slimHeader.cwd;
	console.log(`  header=${JSON.stringify(slimHeader)}`);
	let amCount = 0;
	for (const l of lines) {
		const o = JSON.parse(l);
		if (o.type === 'assistant/message' && amCount < 3) {
			amCount++;
			const d = o.data ?? {};
			const msg = d.message ?? {};
			console.log(`  assistant/message seq=${o.seq} dataKeys=${JSON.stringify(Object.keys(d))}`);
			console.log(`    usage=${JSON.stringify(d.usage)}`);
			console.log(`    messageKeys=${JSON.stringify(Object.keys(msg))}`);
			console.log(`    message.source=${JSON.stringify(msg.source)} message.model=${JSON.stringify(msg.model)} message.id=${JSON.stringify(msg.id)}`);
		}
		if (o.type.startsWith('llm/')) {
			console.log(`  ${o.type} seq=${o.seq} data=${JSON.stringify(o.data).slice(0, 400)}`);
		}
		if (o.type === 'request/header') {
			console.log(`  request/header dataKeys=${JSON.stringify(Object.keys(o.data ?? {}))} data=${JSON.stringify(o.data).slice(0, 400)}`);
		}
	}
	console.log('');
}

for (const f of process.argv.slice(2)) analyze(f);
