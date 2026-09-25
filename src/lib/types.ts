/**
 * Shared RPC contract types — the single source of truth mirroring
 * SPEC.md §3. The browser half (WS3) builds against these shapes; neither
 * side may change them unilaterally.
 *
 * Error contract (SPEC §3): fail loud. Transport/protocol violations are
 * non-200; endpoint-level failures ride the Connection RPC envelope as
 * `{ ok: false, error: { code, message, details } }` which the client RPC
 * helper surfaces as a rejected promise — never a silent empty array or
 * object.
 */

/** Time window selector. `from`/`to` are ISO-8601 date-times. */
export type Range =
	| 'today'
	| 'week'
	| 'month'
	| 'all'
	| { from: string; to: string };

/** True when `r` is the object form of a {@link Range}. */
export function isExplicitRange(r: Range): r is { from: string; to: string } {
	return typeof r === 'object' && r !== null && 'from' in r && 'to' in r;
}

/** Token counters for one call or aggregate. All counts are raw tokens. */
export interface Tokens {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	total: number;
}

/** Cost breakdown with the same shape as {@link Tokens} plus currency. */
export interface Cost extends Tokens {
	currency: 'USD';
}

/**
 * How a row's cost was derived. SPEC §4's four engine states plus WS4's
 * finer verification labels (official-alias = alias priced at its base
 * model's official page; cross-verified = ≥2 independent structured sources;
 * single-source = one dataset only) — all pass through to the UI verbatim.
 * `unpriced` NEVER prices as 0 (cost stays null).
 */
export type PriceMode = 'official' | 'community' | 'shadow' | 'unpriced' | 'official-alias' | 'cross-verified' | 'single-source';

/** `summary` result. cacheHitRate = cacheRead / (input + cacheRead), 0..1. */
export interface SummaryResult {
	tokens: Tokens;
	cost: Cost;
	calls: number;
	cacheHitRate: number;
	sessions: number;
	mainSub: {
		main: { tokens: number; cost: number; calls: number };
		subagent: { tokens: number; cost: number; calls: number };
	};
}

/** How a timeseries point groups calls. 'auto' is resolved from the range. */
export type TimeseriesBucket = 'auto' | 'hour' | 'day' | 'week' | 'month';

export interface TimeseriesRow {
	/** Bucket start: YYYY-MM-DD, or YYYY-MM for month buckets. */
	date: string;
	tokens: number;
	cost: number;
	calls: number;
	/** Token composition, so the chart can show cache vs fresh vs output. */
	input: number;
	cacheRead: number;
	cacheWrite: number;
	output: number;
}

export type BreakdownBy = 'model' | 'provider' | 'session' | 'origin';

export interface BreakdownRow {
	key: string;
	tokens: number;
	cost: number;
	calls: number;
	cacheHitRate: number;
	/** Present only for by=session: subagent-derived totals roll up into
	 * the parent session's key, `sub` keeps the subagent-only share. */
	sub?: number;
	/** Present only for by=session. */
	sessionMeta?: { title: string | null; origin: 'main' | 'subagent'; lastTs: number };
}

export interface DetailFilters {
	model?: string;
	provider?: string;
	sessionId?: string;
}

export interface DetailRow {
	ts: number;
	sessionId: string;
	origin: 'main' | 'subagent';
	parentSession: string | null;
	provider: string | null;
	model: string | null;
	/** Per-call usage in the same short-name shape as summary.tokens. */
	usage: Tokens;
	cost: number | null;
	priceMode: PriceMode;
}

export interface DetailResult {
	rows: DetailRow[];
	total: number;
	page: number;
	pageSize: number;
}

export interface PriceTiers {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface PricingModel {
	model: string;
	provider: string | null;
	tiers: PriceTiers | null;
	priceMode: PriceMode;
	sourceUrl: string | null;
	/** Friendly name for display; null when the catalog has only a raw id. */
	displayName: string | null;
}

export interface PricingResult {
	fetchedAt: number | null;
	source: string;
	models: PricingModel[];
}

export interface RefreshResult {
	rescannedFiles: number;
	newCalls: number;
	durationMs: number;
	pricesRefreshed: boolean | null;
	/** Files that refused to parse in the last refresh (unsupported version,
	 * corrupt frame…) — surfaced, never swallowed. Optional: absent when none. */
	scanErrors?: { file: string; error: string }[];
}

export interface LedgerChannelRow {
	channel: string;
	costType: 'free' | 'paid' | 'quota';
	counts: number;
	lastTs: number | null;
}

export interface LedgerResult {
	available: boolean;
	path: string | null;
	byChannel: LedgerChannelRow[];
	derivedCny: number;
}

/** The host-side service the RPC layer dispatches to (SPEC §3 endpoints). */
export interface UsageService {
	summary(range: Range): Promise<SummaryResult>;
	timeseries(range: Range, bucket: TimeseriesBucket, model?: string): Promise<TimeseriesRow[]>;
	breakdown(range: Range, by: BreakdownBy): Promise<BreakdownRow[]>;
	detail(range: Range, filters: DetailFilters, page: number, pageSize: number): Promise<DetailResult>;
	pricing(): Promise<PricingResult>;
	refresh(options: { prices: boolean }): Promise<RefreshResult>;
	ledger(): Promise<LedgerResult>;
}
