/**
 * zstd multi-frame decompression — golden tests on REAL session fixtures
 * (copied from DSH_HOME/sessions then path-sanitized for publishing,
 * scripts/sanitize-fixtures.mjs; structural evidence in
 * reports/g2-g3-g4-evidence.md — frame counts/lengths changed when the
 * fixtures were re-framed one-line-per-frame, so these assertions check
 * structure, not original byte lengths).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zstdDecompressAll, zstdFrameLength, zstdDecompressRange, ZSTD_MAGIC } from '../src/lib/zstd.ts';

const fixtures = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'fixtures');
const mainFile = readFileSync(path.join(fixtures, 'main-with-usage.v4.zstd'));

test('frame walker covers every frame of a real multi-frame archive', () => {
	const lens = [];
	let off = 0;
	while (off < mainFile.length) {
		const len = zstdFrameLength(mainFile, off);
		lens.push(len);
		off += len;
	}
	assert.equal(off, mainFile.length, 'frames must tile the file exactly');
	assert.ok(lens.length >= 2, `archive must be multi-frame (got ${lens.length})`);
});

test('whole-buffer zstdDecompressSync silently truncates to frame 1 (the G4 trap)', () => {
	const naive = zlib.zstdDecompressSync(mainFile);
	const correct = zstdDecompressAll(mainFile);
	const frame1 = zstdFrameLength(mainFile, 0);
	assert.ok(naive.length < correct.length, 'naive call must return LESS than the full payload');
	assert.equal(naive.length, zlib.zstdDecompressSync(mainFile.subarray(0, frame1)).length, 'naive output == first frame only');
});

test('zstdDecompressAll output is line-oriented JSONL with the known header', () => {
	const text = zstdDecompressAll(mainFile).toString('utf8');
	const lines = text.split('\n').filter((l) => l.length > 0);
	assert.equal(lines.length, 39);
	const header = JSON.parse(lines[0]);
	assert.equal(header.type, 'session');
	assert.equal(header.version, 4);
	assert.equal(header.id, 'session-286aac50-29e8-43b5-be50-1bfbb04e3716');
});

test('zstdDecompressRange decompresses exactly the appended frames', () => {
	const firstFrame = zstdFrameLength(mainFile, 0);
	const tail = zstdDecompressRange(mainFile, firstFrame, mainFile.length);
	const whole = zstdDecompressAll(mainFile);
	assert.equal(whole.length, tail.length + zlib.zstdDecompressSync(mainFile.subarray(0, firstFrame)).length);
});

test('bad magic throws with the offending offset', () => {
	const junk = Buffer.concat([ZSTD_MAGIC, Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff])]);
	assert.throws(() => zstdDecompressAll(junk), /magic expected at offset 4|runs past buffer/);
});

test('range that cuts a frame mid-way refuses loudly', () => {
	const first = zstdFrameLength(mainFile, 0);
	const second = zstdFrameLength(mainFile, first);
	assert.throws(() => zstdDecompressRange(mainFile, first, first + Math.floor(second / 2)), /crosses range end/);
});
