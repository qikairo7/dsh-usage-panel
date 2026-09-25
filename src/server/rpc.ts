/**
 * RPC dispatcher: strict payload validation (Anti-Postel) then delegation
 * to the UsageService. Malformed payloads throw with the offending value —
 * the envelope layer converts that into a loud `ok:false` result, never a
 * best-effort default.
 */
import type {
	BreakdownBy,
	DetailFilters,
	Range,
	TimeseriesBucket,
	UsageService
} from '../lib/types.js';
import { isExplicitRange } from '../lib/types.js';

const RANGE_KEYWORDS = ['today', 'week', 'month', 'all'] as const;
const BREAKDOWN_KEYS = new Set(['model', 'provider', 'session', 'origin']);
const BUCKET_KEYWORDS: TimeseriesBucket[] = ['auto', 'hour', 'day', 'week', 'month'];

function parseBucket(value: unknown, at: string): TimeseriesBucket {
	if (value === undefined || value === null) return 'auto';
	if (typeof value !== 'string' || !BUCKET_KEYWORDS.includes(value as TimeseriesBucket)) {
		throw new Error(`${at}: expected auto|hour|day|week|month, got ${JSON.stringify(value)}`);
	}
	return value as TimeseriesBucket;
}

function parseRange(value: unknown, at: string): Range {
	if (typeof value === 'string' && (RANGE_KEYWORDS as readonly string[]).includes(value)) {
		return value as (typeof RANGE_KEYWORDS)[number];
	}
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const { from, to } = value as { from?: unknown; to?: unknown };
		if (typeof from === 'string' && typeof to === 'string') {
			const fromTs = Date.parse(from);
			const toTs = Date.parse(to);
			if (Number.isNaN(fromTs)) throw new Error(`${at}.from: not a valid ISO date, got ${JSON.stringify(from)}`);
			if (Number.isNaN(toTs)) throw new Error(`${at}.to: not a valid ISO date, got ${JSON.stringify(to)}`);
			if (fromTs > toTs) throw new Error(`${at}: from (${from}) is after to (${to})`);
			return { from, to };
		}
	}
	throw new Error(`${at}: expected "today"|"week"|"month"|"all"|{from,to}, got ${JSON.stringify(value)}`);
}

function parsePositiveInt(value: unknown, at: string, fallback: number, max: number): number {
	if (value === undefined || value === null) return fallback;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		throw new Error(`${at}: expected positive integer, got ${JSON.stringify(value)}`);
	}
	if (value > max) throw new Error(`${at}: ${value} exceeds max ${max}`);
	return value;
}

function parseFilters(value: unknown, at: string): DetailFilters {
	if (value === undefined || value === null) return {};
	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${at}: expected object, got ${JSON.stringify(value)}`);
	}
	const filters: DetailFilters = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (raw === undefined || raw === null || raw === '') continue;
		if (key === 'model' || key === 'provider' || key === 'sessionId') {
			if (typeof raw !== 'string') throw new Error(`${at}.${key}: expected string, got ${JSON.stringify(raw)}`);
			filters[key] = raw;
		} else {
			throw new Error(`${at}: unknown filter key ${JSON.stringify(key)} (allowed: model, provider, sessionId)`);
		}
	}
	return filters;
}

/**
 * Validate one endpoint payload and dispatch. Returns the plain result
 * value; the envelope layer wraps it as `{ok:true, value}`.
 */
export async function dispatchRpc(service: UsageService, endpoint: string, payload: unknown): Promise<Record<string, unknown>> {
	switch (endpoint) {
		case 'summary': {
			const range = parseRange((payload as { range?: unknown } | undefined | null)?.range, 'summary.range');
			return service.summary(range) as unknown as Promise<Record<string, unknown>>;
		}
		case 'timeseries': {
			const p = (payload ?? {}) as { range?: unknown; bucket?: unknown; model?: unknown };
			const range = parseRange(p.range, 'timeseries.range');
			const bucket = parseBucket(p.bucket, 'timeseries.bucket');
			if (p.model !== undefined && p.model !== null && typeof p.model !== 'string') {
				throw new Error(`timeseries.model: expected a string, got ${JSON.stringify(p.model)}`);
			}
			const model = typeof p.model === 'string' && p.model.trim() ? p.model.trim() : undefined;
			return service.timeseries(range, bucket, model) as unknown as Promise<Record<string, unknown>>;
		}

		case 'pricing-update': {
			const p = (payload ?? {}) as { models?: unknown };
			if (!Array.isArray(p.models)) {
				throw new Error(`pricing-update.models: expected an array, got ${JSON.stringify(typeof p.models)}`);
			}
			return service.updatePricing(p.models) as unknown as Promise<Record<string, unknown>>;
		}
		case 'breakdown': {
			const p = (payload ?? {}) as { range?: unknown; by?: unknown };
			const range = parseRange(p.range, 'breakdown.range');
			if (typeof p.by !== 'string' || !BREAKDOWN_KEYS.has(p.by)) {
				throw new Error(`breakdown.by: expected model|provider|session|origin, got ${JSON.stringify(p.by)}`);
			}
			return service.breakdown(range, p.by as BreakdownBy) as unknown as Promise<Record<string, unknown>>;
		}
		case 'detail': {
			const p = (payload ?? {}) as { range?: unknown; filters?: unknown; page?: unknown; pageSize?: unknown };
			const range = parseRange(p.range, 'detail.range');
			const filters = parseFilters(p.filters, 'detail.filters');
			const page = parsePositiveInt(p.page, 'detail.page', 1, 1_000_000);
			const pageSize = parsePositiveInt(p.pageSize, 'detail.pageSize', 50, 500);
			return service.detail(range, filters, page, pageSize) as unknown as Promise<Record<string, unknown>>;
		}
		case 'pricing':
			return service.pricing() as unknown as Promise<Record<string, unknown>>;
		case 'refresh': {
			const p = (payload ?? {}) as { prices?: unknown };
			if (p.prices !== undefined && typeof p.prices !== 'boolean') {
				throw new Error(`refresh.prices: expected boolean, got ${JSON.stringify(p.prices)}`);
			}
			return service.refresh({ prices: p.prices === true }) as unknown as Promise<Record<string, unknown>>;
		}
		case 'ledger':
			return service.ledger() as unknown as Promise<Record<string, unknown>>;
		default:
			throw new Error(`unknown endpoint: ${String(endpoint)}`);
	}
}

/** Exported for tests: range parsing is part of the contract surface. */
export const __testables = { parseRange, parsePositiveInt, parseFilters, isExplicitRange };
