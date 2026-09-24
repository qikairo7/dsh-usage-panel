/**
 * Session parser golden tests — exact numbers from probe evidence on real
 * fixtures; retry semantics (each attempt its own row); refuse-not-misread.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zstdDecompressAll } from '../src/lib/zstd.ts';
import { parseSessionArchive } from '../src/lib/session-parse.ts';

const fixtures = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'fixtures');

test('golden: main session with 2 usage rows (real archive)', () => {
	const text = zstdDecompressAll(readFileSync(path.join(fixtures, 'main-with-usage.v4.zstd'))).toString('utf8');
	const { header, calls } = parseSessionArchive(text, 'golden-main');
	assert.equal(header.origin, 'main');
	assert.equal(header.parentSession, null);
	assert.equal(header.delegationDepth, 0);
	assert.equal(calls.length, 2);
	assert.deepEqual(calls[0].usage, {
		inputTokens: 56164,
		outputTokens: 1510,
		cacheReadTokens: 3456,
		cacheWriteTokens: 0,
		totalTokens: 61130
	});
	assert.equal(calls[0].provider, 'deepseek-official');
	assert.equal(calls[0].model, 'deepseek-flash');
	assert.equal(calls[0].turn, 1);
	assert.equal(calls[0].step, 1);
	assert.equal(calls[0].attempt, 1);
	assert.deepEqual(calls[1].usage, {
		inputTokens: 22457,
		outputTokens: 447,
		cacheReadTokens: 61056,
		cacheWriteTokens: 0,
		totalTokens: 83960
	});
});

test('golden: subagent header lineage', () => {
	const text = zstdDecompressAll(readFileSync(path.join(fixtures, 'subagent-header.v4.zstd'))).toString('utf8');
	const { header, calls } = parseSessionArchive(text, 'golden-sub');
	assert.equal(header.origin, 'subagent');
	assert.equal(header.parentSession, 'session-b2d227b7-2d4e-4918-bfbc-a722bc048ba9');
	assert.equal(header.delegationDepth, 1);
	assert.equal(calls.length, 0, 'header-only archive has no calls');
});

test('golden: v3 header parses (same shape)', () => {
	const text = zstdDecompressAll(readFileSync(path.join(fixtures, 'v3-header.zstd'))).toString('utf8');
	const { header } = parseSessionArchive(text, 'golden-v3');
	assert.equal(header.version, 3);
	assert.equal(header.origin, 'main');
});

function usageRow(seq, time, turn, step, usage) {
	return { type: 'assistant/message', seq, time, data: { turn, step, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'm' } }, usage } };
}

test('retries: every attempt is its own call row with an incrementing ordinal', () => {
	const header = { type: 'session', version: 4, id: 's1', createdAt: 1, delegationDepth: 0 };
	const u = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15 };
	const rows = [
		{ type: 'user/message', seq: 1, time: 1, data: {} },
		usageRow(2, 2, 1, 1, u),
		{ type: 'llm/retry-started', seq: 3, time: 3, data: { retryId: 'r1', turn: 1, step: 1, retry: 1 } },
		usageRow(4, 4, 1, 1, u),
		usageRow(5, 5, 2, 1, u)
	];
	const { calls } = parseSessionArchive(
		[header, ...rows].map((r) => JSON.stringify(r)).join('\n') + '\n',
		'retry-synth'
	);
	assert.equal(calls.length, 3, 'retried attempt counted once each — never folded');
	assert.deepEqual(calls.map((c) => c.attempt), [1, 2, 1]);
});

test('malformed usage refuses with position, not a default', () => {
	const header = { type: 'session', version: 4, id: 's1', createdAt: 1, delegationDepth: 0 };
	const bad = usageRow(2, 2, 1, 1, { inputTokens: 'x', outputTokens: 1, cacheReadTokens: 1, totalTokens: 2 });
	assert.throws(
		() => parseSessionArchive([header, bad].map((r) => JSON.stringify(r)).join('\n'), 'bad'),
		/inputTokens.*expected a finite number/
	);
});

test('older archive shapes: missing cache counters count as 0, missing total recomputes', () => {
	const header = { type: 'session', version: 3, id: 's1', createdAt: 1, delegationDepth: 0 };
	// v3-era row: only input/output/total (real shape, see reports/g2-g3-g4-evidence.md)
	const row1 = usageRow(2, 2, 1, 1, { inputTokens: 51464, outputTokens: 241, totalTokens: 51705 });
	// row without totalTokens: recomputed as the four-part sum
	const row2 = usageRow(3, 3, 1, 2, { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50 });
	const { calls } = parseSessionArchive([header, row1, row2].map((r) => JSON.stringify(r)).join('\n') + '\n', 'old-shapes');
	assert.deepEqual(calls[0].usage, { inputTokens: 51464, outputTokens: 241, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 51705 });
	assert.deepEqual(calls[1].usage, { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50, cacheWriteTokens: 0, totalTokens: 160 });
});

test('unsupported session version refuses', () => {
	const header = { type: 'session', version: 5, id: 's1', delegationDepth: 0 };
	assert.throws(() => parseSessionArchive(JSON.stringify(header), 'v5'), /unsupported session version/);
});
