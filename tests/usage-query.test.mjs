/**
 * usage_query tool regression (acceptance fix f0214c50): single-sided
 * since/until bounds must shape an OPEN range — never fall back to 'all' and
 * silently drop the bound. Fixture: one 2020 call + one today call; a
 * since=today-midnight query must return ONLY the today call.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { apply } = await import('../src/index.ts');

function archiveOf(rows) {
	return Buffer.concat(rows.map((r) => zlib.zstdCompressSync(Buffer.from(JSON.stringify(r) + '\n', 'utf8'))));
}
const header = (id) => ({ type: 'session', version: 4, id, createdAt: 1, delegationDepth: 0 });
const usageRow = (seq, time) => ({
	type: 'assistant/message', seq, time,
	data: { turn: 1, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15 } }
});

function makeEnv(t) {
	const root = mkdtempSync(path.join(tmpdir(), 'usage-query-'));
	const sessionsDir = path.join(root, 'sessions');
	const dataDir = path.join(root, 'data');
	const dir = path.join(sessionsDir, 'slug', 'session-qq');
	mkdirSync(dir, { recursive: true });
	mkdirSync(dataDir, { recursive: true });
	const snapshotPath = path.join(root, 'prices.json');
	writeFileSync(snapshotPath, JSON.stringify({ schemaVersion: 1, source: 'test', fetchedAt: 1, subscriptionShadowMap: {}, channelUnitPricesCny: {}, models: [] }), 'utf8');
	// One call in 2020, one call NOW (real data never lies in the future, and
	// the since-only range ends at now — a future-dated sample would fall
	// outside it no matter how correct the tool is).
	const nowTs = Date.now();
	writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), archiveOf([
		header('session-qq'),
		usageRow(2, Date.UTC(2020, 5, 15, 10, 0, 0)),
		usageRow(3, nowTs)
	]));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return { sessionsDir, dataDir, snapshotPath };
}

function captureTool(env) {
	let tool = null;
	const ctx = {
		tools: { register: (definition) => { tool = definition; } },
		connection: { fetch: { register: () => undefined } },
		// The real host Context carries cordis `effect` (route registration is
		// fiber-bound); the fake must mirror it or apply() legitimately throws.
		effect: (callback) => { const disposer = callback(); return typeof disposer === 'function' ? disposer : () => {}; }
	};
	apply(ctx, { refreshMs: 60000, sessionsDir: env.sessionsDir, dataDir: env.dataDir, priceSnapshotPath: env.snapshotPath });
	assert.ok(tool !== null && typeof tool.execute === 'function', 'usage_query tool must be registered');
	return tool;
}

test('usage_query: since-only shapes [since, now) — today call only, 2020 call excluded', async () => {
	const env = makeEnv(test);
	const tool = captureTool(env);
	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);
	const result = await tool.execute({ group_by: 'summary', since: midnight.toISOString() });
	assert.equal(result.calls, 1, 'only the today call is inside [since, now)');
	assert.equal(result.tokens.input, 10);
});

test('usage_query: until-only shapes [epoch, until) — 2020 call only when until is yesterday', async () => {
	const env = makeEnv(test);
	const tool = captureTool(env);
	const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
	const result = await tool.execute({ group_by: 'summary', until: yesterday.toISOString() });
	assert.equal(result.calls, 1, 'only the 2020 call is inside [epoch, until)');
	assert.equal(result.tokens.input, 10);
});

test('usage_query: no bounds still returns the whole history', async () => {
	const env = makeEnv(test);
	const tool = captureTool(env);
	const result = await tool.execute({ group_by: 'summary' });
	assert.equal(result.calls, 2);
});
