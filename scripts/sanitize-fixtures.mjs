/**
 * One-shot fixture sanitizer (pre-publish hygiene), object-level edition.
 *
 * Pipeline per fixture: re-copy the ORIGINAL archive from DSH_HOME →
 * decompress → parse every JSONL line → walk the parsed tree and rewrite
 * every string VALUE containing real local identifiers → re-serialize →
 * re-compress one frame per line.
 *
 * Replacing on parsed values (not on raw JSON text) makes escape-sequence
 * corruption impossible: JSON.stringify re-escapes whatever the value holds.
 *
 * Re-run safe: re-copies originals first, so prior output never accumulates.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';
import { zstdDecompressAll } from '../src/lib/zstd.ts';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'tests', 'fixtures');

// Originals (read-only source of truth).
const ORIGINALS = {
	'main-with-usage.v4.zstd': 'D:/dsh-data/sessions/--C-Users-Administrator-AppData-Local-Temp-sk-probe-speckit-dsh-probe--/session-286aac50-29e8-43b5-be50-1bfbb04e3716/session.v4.jsonl.zstd',
	'subagent-header.v4.zstd': 'D:/dsh-data/sessions/--D-~65B0~5EFA~6587~4EF6~5939-fusion-novel-StoryOS--/e2c594da-5ba3-4b7c-8f54-5a335c5e178d/session.v4.jsonl.zstd',
	'v3-header.zstd': 'D:/dsh-data/sessions/--D-~65B0~5EFA~6587~4EF6~5939-fusion-novel--/session-03af4dbd-1ef8-4fe8-89e9-93865018e121/session.v3.jsonl.zstd'
};

// Value-level stem replacements — the parsed value holds REAL characters, so
// one spelling per stem suffices regardless of how JSON escaped it.
const STEMS = [
	[/dsh安装插件skills专用/g, 'probe-workspace'],
	[/dsh-data/g, 'probe-data'],
	[/dsh-run/g, 'probe-run'],
	[/新建文件夹/g, 'probe-dir'],
	[/fusion-novel/g, 'fake-project'],
	[/Administrator/g, 'probe-user']
];

let totalHits = 0;
function rewrite(value) {
	if (typeof value === 'string') {
		let out = value;
		for (const [re, to] of STEMS) out = out.replace(re, () => { totalHits += 1; return to; });
		return out;
	}
	if (Array.isArray(value)) return value.map(rewrite);
	if (value !== null && typeof value === 'object') {
		for (const k of Object.keys(value)) value[k] = rewrite(value[k]);
		return value;
	}
	return value;
}

for (const [name, original] of Object.entries(ORIGINALS)) {
	copyFileSync(original, path.join(fixtures, name));
	const text = zstdDecompressAll(readFileSync(path.join(fixtures, name))).toString('utf8');
	const outLines = [];
	for (const line of text.split('\n')) {
		if (line.length === 0) continue;
		outLines.push(JSON.stringify(rewrite(JSON.parse(line))));
	}
	writeFileSync(path.join(fixtures, name), Buffer.concat(outLines.map((l) => zlib.zstdCompressSync(Buffer.from(l + '\n', 'utf8')))));
	console.log(`${name}: ${outLines.length} lines sanitized & re-framed`);
}
console.log(`total value replacements: ${totalHits}`);
