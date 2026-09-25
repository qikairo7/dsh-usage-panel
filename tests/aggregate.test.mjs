/**
 * Service-level invariants on real fixtures + synthesized archives:
 *   1. detail rows sum == summary (aggregate derivation invariant, SPEC §6.7)
 *   2. incremental watermark scan == full reparse (append correctness)
 *   3. price engine four modes; unpriced NEVER yields cost 0
 */
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zstdFrameLength } from '../src/lib/zstd.ts';
import { SessionScanner } from '../src/lib/scanner.ts';
import { UsageStore } from '../src/lib/store.ts';
import { PriceEngine } from '../src/lib/pricing.ts';
import { createUsageService } from '../src/server/usage-service.ts';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

/** Compress each JSONL line as its own zstd frame (writer simulation). */
function archiveOf(rows) {
	const parts = [];
	for (const row of rows) parts.push(zlib.zstdCompressSync(Buffer.from(JSON.stringify(row) + '\n', 'utf8')));
	return Buffer.concat(parts);
}

function header(id, extra = {}) {
	return { type: 'session', version: 4, id, createdAt: 1700000000000, delegationDepth: 0, agentPreset: 'standard', ...extra };
}
function usageRow(seq, time, turn, step, usage, provider = 'prov-a', model = 'model-a') {
	return {
		type: 'assistant/message', seq, time,
		data: { turn, step, message: { role: 'assistant', content: [], source: { kind: 'model', provider, model } }, usage }
	};
}
const U = (i, o, c) => ({ inputTokens: i, outputTokens: o, cacheReadTokens: c, cacheWriteTokens: 0, totalTokens: i + o + c });

const snapshot = {
	schemaVersion: 1,
	source: 'test-snapshot',
	fetchedAt: 1700000000000,
	subscriptionShadowMap: { 'prov-sub': 'model-a' },
	channelUnitPricesCny: {},
	models: [
		{ model: 'model-a', provider: 'prov-a', tiers: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.4 }, priceMode: 'official', sourceUrl: 'https://example.test/a' }
	]
};

function makeEnv(t) {
	const root = mkdtempSync(path.join(tmpdir(), 'usage-panel-test-'));
	const sessionsDir = path.join(root, 'sessions');
	const dataDir = path.join(root, 'data');
	mkdirSync(sessionsDir, { recursive: true });
	mkdirSync(dataDir, { recursive: true });
	const snapshotPath = path.join(root, 'prices.test.json');
	writeFileSync(snapshotPath, JSON.stringify(snapshot), 'utf8');
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return { root, sessionsDir, dataDir, snapshotPath };
}

function serviceOf(env, refreshMs = 60000) {
	return createUsageService({ sessionsDir: env.sessionsDir, ledgerPath: null, refreshMs, dataDir: env.dataDir, priceSnapshotPath: env.snapshotPath });
}

test('invariant: detail sums == summary (synthesized multi-session archive)', async () => {
	const env = makeEnv(test);
	const dirA = path.join(env.sessionsDir, 'slug-x', 'session-aaa');
	const dirB = path.join(env.sessionsDir, 'slug-x', 'session-bbb'); // subagent of aaa
	mkdirSync(dirA, { recursive: true });
	mkdirSync(dirB, { recursive: true });
	writeFileSync(path.join(dirA, 'session.v4.jsonl.zstd'), archiveOf([
		header('session-aaa'),
		usageRow(2, 1700000001000, 1, 1, U(1000, 200, 3000)),
		usageRow(3, 1700000002000, 1, 2, U(500, 100, 500)),
		usageRow(4, 1700000002500, 2, 1, U(50, 25, 25), 'prov-x', 'model-c') // unpriced
	]));
	writeFileSync(path.join(dirB, 'session.v4.jsonl.zstd'), archiveOf([
		header('session-bbb', { origin: 'subagent', parentSession: 'session-aaa' }),
		usageRow(2, 1700000003000, 1, 1, U(200, 50, 0), 'prov-sub', 'model-b')
	]));
	const svc = serviceOf(env);
	const summary = await svc.summary('all');
	const detail = await svc.detail('all', {}, 1, 100);
	// token invariant
	assert.equal(detail.total, 4);
	assert.equal(detail.rows.reduce((s, r) => s + r.usage.input, 0), summary.tokens.input);
	assert.equal(detail.rows.reduce((s, r) => s + r.usage.output, 0), summary.tokens.output);
	assert.equal(detail.rows.reduce((s, r) => s + r.usage.cacheRead, 0), summary.tokens.cacheRead);
	assert.equal(detail.rows.reduce((s, r) => s + r.usage.total, 0), summary.tokens.total);
	assert.equal(summary.tokens.input, 1750);
	assert.equal(summary.tokens.total, 5650);
	// cost invariant (null costs excluded, never zeroed)
	const costSum = detail.rows.reduce((s, r) => s + (r.cost ?? 0), 0);
	assert.ok(Math.abs(costSum - summary.cost.total) < 1e-9);
	assert.ok(Math.abs(summary.cost.total - 0.00275) < 1e-9);
	// main/sub split
	assert.equal(summary.mainSub.main.calls, 3);
	assert.equal(summary.mainSub.subagent.calls, 1);
	assert.equal(summary.mainSub.subagent.tokens, 250);
	// cache hit rate = 3525 / (1750 + 3525) — every call's input counts, subagent included
	assert.ok(Math.abs(summary.cacheHitRate - 3525 / 5275) < 1e-9);
	// session breakdown rolls the subagent into its parent, sub field keeps the share
	const bySession = await svc.breakdown('all', 'session');
	const rowA = bySession.find((r) => r.key === 'session-aaa');
	assert.ok(rowA, 'parent session row exists');
	assert.equal(rowA.calls, 4);
	assert.equal(rowA.sub, 250);
	const byModel = await svc.breakdown('all', 'model');
	assert.equal(byModel.length, 3);
	// pricing modes on the detail rows: official + shadow + unpriced
	const modes = new Map(detail.rows.map((r) => [r.priceMode, r.cost]));
	assert.equal(modes.get('official') !== null, true);
	assert.equal(modes.get('shadow') !== null, true);
	assert.equal(modes.get('unpriced'), null, 'unpriced rows carry cost:null, never 0');
	// timeseries by local day
	const ts = await svc.timeseries('all', 'day');
	assert.equal(ts.length, 1);
	assert.equal(ts[0].calls, 4);
	// token composition sums to the bucket total, so the chart cannot drift from it
	assert.equal(ts[0].input + ts[0].cacheRead + ts[0].cacheWrite + ts[0].output, ts[0].tokens);
});

test('timeseries: bucket width follows the range; a single model can be isolated', async () => {
	const env = makeEnv(test);
	const dir = path.join(env.sessionsDir, 'slug-x', 'session-aaa');
	mkdirSync(dir, { recursive: true });
	// Two calls on the same local day: one on model-b, one on model-c.
	writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), archiveOf([
		header('session-aaa'),
		usageRow(2, 1700000001000, 1, 1, U(200, 50, 0), 'prov-sub', 'model-b'),
		usageRow(3, 1700000002000, 1, 2, U(50, 25, 25), 'prov-x', 'model-c')
	]));
	const svc = serviceOf(env);

	// Every fixture sits on one local day, so month buckets collapse them to one row.
	const byMonth = await svc.timeseries('all', 'auto');
	assert.equal(byMonth.length, 1, 'a day-wide history bucketed by month is one point');
	assert.equal(byMonth[0].date.length, 7, 'month bucket keys as YYYY-MM');
	assert.equal(byMonth[0].calls, 2);

	// Explicit day buckets still work when asked for.
	const byDay = await svc.timeseries('all', 'day');
	assert.equal(byDay[0].date.length, 10, 'day bucket keys as YYYY-MM-DD');

	// Hour buckets key as "YYYY-MM-DD HH:00"; both calls share one hour.
	const byHour = await svc.timeseries('all', 'hour');
	assert.equal(byHour.length, 1);
	assert.equal(byHour[0].date.length, 16, 'hour bucket keys as YYYY-MM-DD HH:00');
	assert.equal(byHour[0].calls, 2);

	// Composition is preserved across bucket widths.
	assert.equal(byMonth[0].input, 250);
	assert.equal(byMonth[0].output, 75);
	assert.equal(byMonth[0].cacheRead, 25);
	assert.equal(byMonth[0].input + byMonth[0].cacheRead + byMonth[0].cacheWrite + byMonth[0].output, byMonth[0].tokens);

	// Per-model trend: model-b alone is a single call.
	const onlyB = await svc.timeseries('all', 'day', 'model-b');
	assert.equal(onlyB.length, 1);
	assert.equal(onlyB[0].calls, 1, 'model filter restricts the bucket to that model');
	assert.equal(onlyB[0].tokens, 250);

	// An unknown model yields no rows — never a silent "everything".
	const none = await svc.timeseries('all', 'day', 'no-such-model');
	assert.equal(none.length, 0);
});

test('invariant: incremental append scan == full reparse (real fixture split)', async () => {
	const env = makeEnv(test);
	const dir = path.join(env.sessionsDir, 'speckit', 'session-286aac50-29e8-43b5-be50-1bfbb04e3716');
	mkdirSync(dir, { recursive: true });
	const full = readFileSync(path.join(fixtures, 'main-with-usage.v4.zstd'));
	// split at a frame boundary: first 5 frames, then the whole file
	let off = 0;
	const cuts = [];
	while (off < full.length && cuts.length < 5) {
		off += zstdFrameLength(full, off);
		cuts.push(off);
	}
	const partial = full.subarray(0, cuts[cuts.length - 1]);
	const file = path.join(dir, 'session.v4.jsonl.zstd');
	writeFileSync(file, partial);
	const wm = path.join(env.dataDir, 'wm.json');
	const store1 = new UsageStore(path.join(env.dataDir, 'store1.json'));
	let outcome = await new SessionScanner(env.sessionsDir, wm).scan();
	assert.equal(outcome.results.length, 1);
	store1.replaceSession(outcome.results[0].sessionId, outcome.results[0].records);
	// append the rest, rescan incrementally
	writeFileSync(file, full);
	// bump mtime explicitly (same-second writes can keep mtimeMs equal)
	const future = new Date(Date.now() + 5000);
	utimesSync(file, future, future);
	const scanner2 = new SessionScanner(env.sessionsDir, wm);
	outcome = await scanner2.scan();
	assert.equal(outcome.results[0].mode, 'append', 'second pass must be incremental');
	store1.appendSession(outcome.results[0].sessionId, outcome.results[0].records);
	// fresh full rescan for ground truth
	const wmFresh = path.join(env.dataDir, 'wm-fresh.json');
	const outcomeFresh = await new SessionScanner(env.sessionsDir, wmFresh).scan();
	const store2 = new UsageStore(path.join(env.dataDir, 'store2.json'));
	store2.replaceSession(outcomeFresh.results[0].sessionId, outcomeFresh.results[0].records);
	assert.deepEqual(store1.allRecords(), store2.allRecords(), 'incremental == full reparse, attempt ordinals included');
	assert.equal(store1.recordCount(), 2);
});

test('price engine four modes', async () => {
	const env = makeEnv(test);
	const engine = await PriceEngine.load(env.snapshotPath, path.join(env.dataDir, 'community.json'));
	// official
	const official = engine.priceCall(U(1_000_000, 1_000_000, 0), 'prov-a', 'model-a');
	assert.equal(official.priceMode, 'official');
	assert.ok(Math.abs(official.cost - (1 + 2)) < 1e-9);
	// shadow: prov-sub maps to model-a's official tiers
	const shadow = engine.priceCall(U(1_000_000, 1_000_000, 0), 'prov-sub', 'model-b');
	assert.equal(shadow.priceMode, 'shadow');
	assert.ok(Math.abs(shadow.cost - 3) < 1e-9);
	// unpriced: cost null, NEVER 0
	const unpriced = engine.priceCall(U(1_000_000, 1_000_000, 0), null, 'who-knows');
	assert.equal(unpriced.priceMode, 'unpriced');
	assert.equal(unpriced.cost, null);
	// community: fills in models the curated snapshot does NOT cover. The
	// snapshot is consulted first on purpose — it holds vendor-verified prices,
	// and letting a broad aggregator row win would mislabel an official price
	// as 社区源 (regression: claude-sonnet-4-6 / gemini-3.8-flash showed 社区源).
	writeFileSync(path.join(env.dataDir, 'community.json'), JSON.stringify({
		schemaVersion: 1, source: 'community-test', fetchedAt: 1,
		subscriptionShadowMap: {}, channelUnitPricesCny: {},
		models: [
			{ model: 'model-a', tiers: { input: 5, output: 5, cacheRead: 0, cacheWrite: 0 }, priceMode: 'community' },
			{ model: 'community-only', tiers: { input: 7, output: 7, cacheRead: 0, cacheWrite: 0 }, priceMode: 'community' }
		]
	}), 'utf8');
	const engine2 = await PriceEngine.load(env.snapshotPath, path.join(env.dataDir, 'community.json'));
	// curated snapshot wins for a model it covers
	const curatedWins = engine2.priceCall(U(1_000_000, 0, 0), 'prov-a', 'model-a');
	assert.equal(curatedWins.priceMode, 'official', 'curated snapshot must win over the community cache');
	assert.ok(Math.abs(curatedWins.cost - 1) < 1e-9);
	// community still supplies models the snapshot lacks
	const communityFills = engine2.priceCall(U(1_000_000, 0, 0), 'prov-a', 'community-only');
	assert.equal(communityFills.priceMode, 'community');
	assert.ok(Math.abs(communityFills.cost - 7) < 1e-9);
	// catalog keeps curated-only models AND labels curated ones correctly
	const cat = engine2.catalog();
	const curated = cat.models.find((m) => m.model === 'model-a');
	assert.equal(curated.priceMode, 'official', 'catalog must report the curated mode, not community');
	assert.ok(cat.models.some((m) => m.model === 'community-only'), 'catalog must still include community-only models');
});

test('price engine: WS4 snapshot shapes (all-null tiers, per-dim null, ISO fetchedAt, array shadowMap)', async () => {
	const root = mkdtempSync(path.join(tmpdir(), 'usage-ws4-'));
	const snap = path.join(root, 'ws4.json');
	writeFileSync(snap, JSON.stringify({
		schemaVersion: 1, source: 'ws4', fetchedAt: '2026-09-25T06:24:05+08:00',
		subscriptionShadowMap: { 'relay-x': ['model-priced', 'other'] },
		channelUnitPricesCny: { kimi: 0.01 },
		models: [
			{ model: 'model-void', provider: 'p', tiers: { input: null, output: null, cacheRead: null, cacheWrite: null }, priceMode: 'unpriced' },
			{ model: 'model-priced', provider: 'p', tiers: { input: 1, output: 1, cacheRead: 1, cacheWrite: null }, priceMode: 'official' }
		]
	}), 'utf8');
	test.after(() => rmSync(root, { recursive: true, force: true }));
	const engine = await PriceEngine.load(snap, path.join(root, 'none.json'));
	// all-null tiers stays unpriced — cost null, never 0
	const voidCall = engine.priceCall(U(1_000_000, 1_000_000, 0), 'p', 'model-void');
	assert.equal(voidCall.cost, null);
	assert.equal(voidCall.priceMode, 'unpriced');
	// per-dim null (cacheWrite) prices as 0 on that dimension
	const priced = engine.priceCall(U(1_000_000, 1_000_000, 1_000_000), 'p', 'model-priced');
	assert.ok(Math.abs(priced.cost - 3) < 1e-9);
	// array-valued shadowMap accepted; unknown model on a relay falls back to the first id
	const relay = engine.priceCall(U(1_000_000, 0, 0), 'relay-x', 'mystery-model');
	assert.equal(relay.priceMode, 'shadow');
	assert.ok(Math.abs(relay.cost - 1) < 1e-9);
	// ledger unit prices flow through; ISO fetchedAt parses
	assert.deepEqual(engine.channelUnitPricesCny(), { kimi: 0.01 });
	const cat = engine.catalog();
	assert.equal(cat.fetchedAt, Date.parse('2026-09-25T06:24:05+08:00'));
	assert.equal(cat.models.filter((m) => m.tiers === null).length, 1);
});

test('price engine: OpenRouter/LiteLLM units are USD-per-token → ×1e6 (WS4 probed shapes)', async () => {
	const { normalizeOpenRouter, normalizeLiteLLM } = await import('../src/lib/pricing.ts');
	// WS4 §1: OR pricing values are USD/token strings; input_cache_write often null
	const or = normalizeOpenRouter({ data: [{ id: 'z-ai/glm-5.3', pricing: { prompt: '0.0000014', completion: '0.0000044', input_cache_read: '0.00000026', input_cache_write: null } }] });
	assert.deepEqual(or[0].tiers, { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 });
	// WS4 §1: LiteLLM fields are *_cost_per_token (USD/token)
	const ll = normalizeLiteLLM({ 'zai/glm-5.3': { mode: 'chat', litellm_provider: 'zai', input_cost_per_token: 0.0000014, output_cost_per_token: 0.0000044, cache_read_input_token_cost: 0.00000026 } });
	assert.deepEqual(ll[0].tiers, { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 });
});
