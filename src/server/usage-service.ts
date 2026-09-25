/**
 * UsageService — the real host-side implementation behind SPEC §3's seven
 * RPC endpoints. Wires scanner → store → price engine → ledger; read
 * endpoints run `ensureFresh` first, so a UI polling ≤60s sees data ≤60s
 * old without any host-side timer (SPEC: no host daemon; G3 fallback).
 *
 * Aggregate views are computed from the call-level rows at query time —
 * "detail sum == summary" holds by construction (tested invariant).
 */
import path from 'node:path';
import type {
	BreakdownBy,
	BreakdownRow,
	Cost,
	DetailResult,
	DetailRow,
	DetailFilters,
	LedgerResult,
	PriceMode,
	PricingResult,
	Range,
	RefreshResult,
	SummaryResult,
	TimeseriesBucket,
	TimeseriesRow,
	Tokens,
	UsageService
} from '../lib/types.js';
import { isExplicitRange } from '../lib/types.js';
import type { CallRecord, Usage } from '../lib/session-parse.js';
import { SessionScanner } from '../lib/scanner.js';
import { UsageStore } from '../lib/store.js';
import { PriceEngine } from '../lib/pricing.js';
import { readLedger } from '../lib/ledger.js';

export interface UsageServiceOptions {
	sessionsDir: string;
	ledgerPath: string | null;
	refreshMs: number;
	/** Persistence root (G2): default $DSH_HOME/dsh-usage-panel. */
	dataDir: string;
	priceSnapshotPath?: string;
}

function emptyTokens(): Tokens {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

function addTokens(into: Tokens, from: Usage): void {
	into.input += from.inputTokens;
	into.output += from.outputTokens;
	into.cacheRead += from.cacheReadTokens;
	into.cacheWrite += from.cacheWriteTokens;
	into.total += from.totalTokens;
}

/** Resolve a Range to [fromTs, toTs) epoch-ms in LOCAL time. */
export function resolveRange(range: Range, now = Date.now()): { from: number; to: number } {
	if (isExplicitRange(range)) {
		const from = Date.parse(range.from);
		const to = Date.parse(range.to);
		if (Number.isNaN(from) || Number.isNaN(to)) throw new Error(`range: invalid ISO dates ${JSON.stringify(range)}`);
		return { from, to };
	}
	const d = new Date(now);
	switch (range) {
		case 'today': {
			const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
			return { from: start, to: now + 1 };
		}
		case 'week':
			return { from: now - 7 * 24 * 3600 * 1000, to: now + 1 };
		case 'month':
			return { from: now - 30 * 24 * 3600 * 1000, to: now + 1 };
		case 'all':
			return { from: 0, to: Number.MAX_SAFE_INTEGER };
	}
}

/** Local-time YYYY-MM-DD bucket key. */
function dayBucket(ts: number): string {
	const d = new Date(ts);
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}

/** Local-time YYYY-MM bucket key (month granularity). */
function monthBucket(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * ISO week (Mon–Sun) start as a YYYY-MM-DD key. Week buckets keep a
 * "trend over weeks" readable instead of collapsing a month into 30 points.
 */
function weekBucket(ts: number): string {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	// JS getDay(): 0=Sun..6=Sat; shift so Monday is the week's first day.
	const shift = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - shift);
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Pick a bucket width the range actually needs. A day-wide window bucketed
 * hourly-or-daily is one point either way, while "all history" bucketed daily
 * would be hundreds of unreadable points.
 */
function resolveBucket(bucket: TimeseriesBucket, range: Range): 'day' | 'week' | 'month' {
	if (bucket !== 'auto') return bucket;
	if (isExplicitRange(range)) {
		const spanDays = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
		if (spanDays > 180) return 'month';
		if (spanDays > 21) return 'week';
		return 'day';
	}
	if (range === 'today') return 'day';
	if (range === 'week') return 'day';
	if (range === 'month') return 'week';
	return 'month';
}

export function createUsageService(options: UsageServiceOptions): UsageService {
	const store = new UsageStore(path.join(options.dataDir, 'usage-store.json'));
	const scanner = new SessionScanner(options.sessionsDir, path.join(options.dataDir, 'scan-watermark.json'));
	let engine: PriceEngine | null = null;
	let lastScanAt = 0;
	let lastNewCalls = 0;
	let inFlight: Promise<void> | null = null;
	let lastScanErrors: { file: string; error: string }[] = [];

	async function ensureEngine(): Promise<PriceEngine> {
		if (engine === null) {
			engine = await PriceEngine.load(options.priceSnapshotPath, path.join(options.dataDir, 'prices-community.json'));
		}
		return engine;
	}

	async function doScan(): Promise<void> {
		await store.load();
		const before = store.recordCount();
		const outcome = await scanner.scan();
		for (const result of outcome.results) {
			if (result.mode === 'full') store.replaceSession(result.sessionId, result.records);
			else store.appendSession(result.sessionId, result.records);
		}
		store.dropMissing(outcome.sessionIds);
		await store.save();
		lastScanAt = Date.now();
		lastNewCalls = store.recordCount() - before;
		lastScanErrors = outcome.errors;
		for (const err of outcome.errors) console.error(`usage-panel: scan refused ${err.file}: ${err.error}`);
	}

	async function ensureFresh(force = false): Promise<void> {
		if (inFlight !== null) {
			await inFlight;
			return;
		}
		if (!force && lastScanAt !== 0 && Date.now() - lastScanAt < options.refreshMs) return;
		const run = (async () => {
			await doScan();
		})();
		inFlight = run;
		try {
			await run;
		} finally {
			inFlight = null;
		}
	}

	function recordsInRange(from: number, to: number): CallRecord[] {
		return store.allRecords().filter((r) => r.ts >= from && r.ts < to);
	}

	function priceParts(records: CallRecord[], priceEngine: PriceEngine): { cost: Cost; perRow: Map<CallRecord, { cost: number | null; priceMode: PriceMode }> } {
		const cost: Cost = { ...emptyTokens(), currency: 'USD' };
		const perRow = new Map<CallRecord, { cost: number | null; priceMode: PriceMode }>();
		for (const r of records) {
			const priced = priceEngine.priceCall(r.usage, r.provider, r.model);
			perRow.set(r, priced);
			if (priced.cost === null) continue; // unpriced: never added, never 0
			const hit = priceEngine.lookup(r.provider, r.model);
			const t = hit.tiers;
			if (t === null) throw new Error(`priceCall returned cost for unpriced ${JSON.stringify(r.model)} — invariant broken`);
			cost.input += (r.usage.inputTokens / 1e6) * t.input;
			cost.output += (r.usage.outputTokens / 1e6) * t.output;
			cost.cacheRead += (r.usage.cacheReadTokens / 1e6) * t.cacheRead;
			cost.cacheWrite += (r.usage.cacheWriteTokens / 1e6) * t.cacheWrite;
			cost.total += priced.cost;
		}
		return { cost, perRow };
	}

	return {
		async summary(range: Range): Promise<SummaryResult> {
			await ensureFresh();
			const priceEngine = await ensureEngine();
			const { from, to } = resolveRange(range);
			const records = recordsInRange(from, to);
			const tokens = emptyTokens();
			for (const r of records) addTokens(tokens, r.usage);
			const { cost } = priceParts(records, priceEngine);
			const denom = tokens.input + tokens.cacheRead;
			const main = { tokens: 0, cost: 0, calls: 0 };
			const subagent = { tokens: 0, cost: 0, calls: 0 };
			for (const r of records) {
				const priced = priceEngine.priceCall(r.usage, r.provider, r.model);
				const bucket = r.origin === 'subagent' ? subagent : main;
				bucket.tokens += r.usage.totalTokens;
				bucket.calls += 1;
				if (priced.cost !== null) bucket.cost += priced.cost;
			}
			return {
				tokens,
				cost,
				calls: records.length,
				cacheHitRate: denom > 0 ? tokens.cacheRead / denom : 0,
				sessions: new Set(records.map((r) => r.sessionId)).size,
				mainSub: { main, subagent }
			};
		},

		async timeseries(range: Range, bucket: TimeseriesBucket, model?: string): Promise<TimeseriesRow[]> {
			await ensureFresh();
			const priceEngine = await ensureEngine();
			const { from, to } = resolveRange(range);
			const effective = resolveBucket(bucket, range);
			const keyFor = effective === 'month' ? monthBucket : effective === 'week' ? weekBucket : dayBucket;
			const records = model === undefined ? recordsInRange(from, to) : recordsInRange(from, to).filter((r) => r.model === model);
			interface Acc {
				tokens: number;
				cost: number;
				calls: number;
				input: number;
				cacheRead: number;
				cacheWrite: number;
				output: number;
			}
			const rows = new Map<string, Acc>();
			for (const r of records) {
				const key = keyFor(r.ts);
				const row = rows.get(key) ?? { tokens: 0, cost: 0, calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
				row.tokens += r.usage.totalTokens;
				row.input += r.usage.inputTokens;
				row.cacheRead += r.usage.cacheReadTokens;
				row.cacheWrite += r.usage.cacheWriteTokens;
				row.output += r.usage.outputTokens;
				row.calls += 1;
				const priced = priceEngine.priceCall(r.usage, r.provider, r.model);
				if (priced.cost !== null) row.cost += priced.cost;
				rows.set(key, row);
			}
			return [...rows.entries()]
				.map(([date, v]) => ({ date, ...v }))
				.sort((a, b) => (a.date < b.date ? -1 : 1));
		},

		async breakdown(range: Range, by: BreakdownBy): Promise<BreakdownRow[]> {
			await ensureFresh();
			const priceEngine = await ensureEngine();
			const { from, to } = resolveRange(range);
			const records = recordsInRange(from, to);
			interface Acc {
				key: string;
				tokens: number;
				cost: number;
				calls: number;
				cacheRead: number;
				cacheDenom: number;
				subTokens: number;
				lastTs: number;
				origin: 'main' | 'subagent';
			}
			const accs = new Map<string, Acc>();
			for (const r of records) {
				let key: string;
				if (by === 'model') key = r.model ?? '(unknown model)';
				else if (by === 'provider') key = r.provider ?? '(unknown provider)';
				else if (by === 'origin') key = r.origin;
				else {
					// session: subagent-derived totals roll up into the parent session
					key = r.origin === 'subagent' && r.parentSession !== null ? r.parentSession : r.sessionId;
				}
				const acc = accs.get(key) ?? { key, tokens: 0, cost: 0, calls: 0, cacheRead: 0, cacheDenom: 0, subTokens: 0, lastTs: 0, origin: 'main' as const };
				acc.tokens += r.usage.totalTokens;
				acc.calls += 1;
				acc.cacheRead += r.usage.cacheReadTokens;
				acc.cacheDenom += r.usage.inputTokens + r.usage.cacheReadTokens;
				acc.lastTs = Math.max(acc.lastTs, r.ts);
				if (r.origin === 'subagent') {
					acc.subTokens += r.usage.totalTokens;
					acc.origin = 'subagent';
				}
				const priced = priceEngine.priceCall(r.usage, r.provider, r.model);
				if (priced.cost !== null) acc.cost += priced.cost;
				accs.set(key, acc);
			}
			const out: BreakdownRow[] = [...accs.values()].map((acc) => ({
				key: acc.key,
				tokens: acc.tokens,
				cost: acc.cost,
				calls: acc.calls,
				cacheHitRate: acc.cacheDenom > 0 ? acc.cacheRead / acc.cacheDenom : 0,
				...(by === 'session'
					? { sub: acc.subTokens, sessionMeta: { title: null, origin: acc.origin, lastTs: acc.lastTs } }
					: {})
			}));
			out.sort((a, b) => b.tokens - a.tokens);
			return out;
		},

		async detail(range: Range, filters: DetailFilters, page: number, pageSize: number): Promise<DetailResult> {
			await ensureFresh();
			const priceEngine = await ensureEngine();
			const { from, to } = resolveRange(range);
			const all = recordsInRange(from, to)
				.filter((r) => (filters.model === undefined || r.model === filters.model))
				.filter((r) => (filters.provider === undefined || r.provider === filters.provider))
				.filter((r) => (filters.sessionId === undefined || r.sessionId === filters.sessionId || r.parentSession === filters.sessionId))
				.sort((a, b) => b.ts - a.ts);
			const start = (page - 1) * pageSize;
			const slice = all.slice(start, start + pageSize);
			const rows: DetailRow[] = slice.map((r) => {
				const priced = priceEngine.priceCall(r.usage, r.provider, r.model);
				return {
					ts: r.ts,
					sessionId: r.sessionId,
					origin: r.origin,
					parentSession: r.parentSession,
					provider: r.provider,
					model: r.model,
					usage: {
						input: r.usage.inputTokens,
						output: r.usage.outputTokens,
						cacheRead: r.usage.cacheReadTokens,
						cacheWrite: r.usage.cacheWriteTokens,
						total: r.usage.totalTokens
					},
					cost: priced.cost,
					priceMode: priced.priceMode
				};
			});
			return { rows, total: all.length, page, pageSize };
		},

		async pricing(): Promise<PricingResult> {
			const priceEngine = await ensureEngine();
			return priceEngine.catalog();
		},

		async refresh(refreshOptions: { prices: boolean }): Promise<RefreshResult> {
			const priceEngine = await ensureEngine();
			const t0 = Date.now();
			await ensureFresh(true);
			let pricesRefreshed: boolean | null = null;
			if (refreshOptions.prices) {
				await priceEngine.refreshCommunity();
				pricesRefreshed = true;
			}
			return {
				rescannedFiles: store.sessionCount(),
				newCalls: lastNewCalls,
				durationMs: Date.now() - t0,
				pricesRefreshed,
				...(lastScanErrors.length > 0 ? { scanErrors: lastScanErrors } : {})
			};
		},

		async ledger(): Promise<LedgerResult> {
			const priceEngine = await ensureEngine();
			return readLedger(options.ledgerPath, priceEngine.channelUnitPricesCny());
		}
	};
}
