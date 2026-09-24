/**
 * Ledger reader (WS1 conclusions) + RPC payload validation (Anti-Postel).
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readLedger } from '../src/lib/ledger.ts';
import { __testables } from '../src/server/rpc.ts';

test('ledger: missing file is an empty state, never a throw', async () => {
	const result = await readLedger(path.join(tmpdir(), 'definitely-not-here-', String(Date.now()), 'route-ledger.jsonl'), {});
	assert.equal(result.available, false);
	assert.equal(result.byChannel.length, 0);
	assert.equal(result.derivedCny, 0);
});

test('ledger: decision rows aggregate by channel×cost, meta rows excluded, unit prices derive CNY', async () => {
	const root = mkdtempSync(path.join(tmpdir(), 'ledger-'));
	const file = path.join(root, 'route-ledger.jsonl');
	const rows = [
		{ ts: 100, channel: 'anysearch', cost: 'free', latencyMs: 500, outcome: 'ok' },
		{ ts: '2026-09-25T06:24:05+08:00', channel: 'anysearch', cost: 'free', latencyMs: 0, outcome: 'empty' },
		{ ts: 300, channel: 'firecrawl', cost: 'paid', latencyMs: 900, outcome: 'ok' },
		{ recordType: 'meta', ts: 400, note: 'schema v2 migration' },
		{ ts: '2026-09-25T07:00:00+08:00', channel: 'anysearch', cost: 'free', latencyMs: 100, outcome: 'ok' }
	];
	writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
	const result = await readLedger(file, { anysearch: 0.01, firecrawl: 0.5 });
	assert.equal(result.available, true);
	assert.deepEqual(
		result.byChannel.map((r) => ({ channel: r.channel, costType: r.costType, counts: r.counts, lastTs: r.lastTs })),
		[
			// lastTs parses from the ISO-string rows (real WS1 schema), not null
			{ channel: 'anysearch', costType: 'free', counts: 3, lastTs: Date.parse('2026-09-25T07:00:00+08:00') },
			{ channel: 'firecrawl', costType: 'paid', counts: 1, lastTs: 300 }
		]
	);
	assert.ok(Math.abs(result.derivedCny - (0.01 * 3 + 0.5)) < 1e-9);
	rmSync(root, { recursive: true, force: true });
});

test('ledger: corrupt line refuses with file and line number', async () => {
	const root = mkdtempSync(path.join(tmpdir(), 'ledger-'));
	const file = path.join(root, 'route-ledger.jsonl');
	writeFileSync(file, '{"ts":1,"channel":"a","cost":"free"}\n{not json\n', 'utf8');
	await assert.rejects(() => readLedger(file, {}), /line 2 is not valid JSON/);
	rmSync(root, { recursive: true, force: true });
});

const { parseRange, parsePositiveInt, parseFilters } = __testables;

test('rpc validation: range accepts keywords and explicit windows only', () => {
	assert.equal(parseRange('today', 'r'), 'today');
	assert.deepEqual(parseRange({ from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' }, 'r'), {
		from: '2026-01-01T00:00:00Z',
		to: '2026-01-02T00:00:00Z'
	});
	assert.throws(() => parseRange('yesterday', 'r'), /expected "today"|"week"|"month"|"all"/);
	assert.throws(() => parseRange({ from: 'nope', to: '2026-01-02T00:00:00Z' }, 'r'), /from: not a valid ISO date/);
	assert.throws(() => parseRange({ from: '2026-01-03T00:00:00Z', to: '2026-01-02T00:00:00Z' }, 'r'), /is after to/);
});

test('rpc validation: pagination and filters reject garbage', () => {
	assert.equal(parsePositiveInt(undefined, 'p', 7, 100), 7);
	assert.equal(parsePositiveInt(3, 'p', 7, 100), 3);
	assert.throws(() => parsePositiveInt(0, 'p', 7, 100), /expected positive integer/);
	assert.throws(() => parsePositiveInt(1.5, 'p', 7, 100), /expected positive integer/);
	assert.throws(() => parsePositiveInt(999, 'p', 7, 100), /exceeds max/);
	assert.deepEqual(parseFilters({ model: 'm', sessionId: 's' }, 'f'), { model: 'm', sessionId: 's' });
	assert.deepEqual(parseFilters({ model: null }, 'f'), {});
	assert.throws(() => parseFilters({ bogus: 1 }, 'f'), /unknown filter key/);
	assert.throws(() => parseFilters({ model: 42 }, 'f'), /expected string/);
});
