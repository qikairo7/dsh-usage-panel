/**
 * Price engine — SPEC §4. Four price modes; `unpriced` NEVER prices as 0.
 *
 * Sources, in lookup order:
 *   1. community cache ($DSH_HOME/dsh-usage-panel/prices-community.json,
 *      written by refreshCommunity — OpenRouter /api/v1/models and LiteLLM
 *      model_prices; live probing is WS4's G1 gate, so refresh is opt-in)
 *   2. built-in snapshot data/prices.snapshot.json (official verified tiers)
 *   3. subscriptionShadowMap: providers on subscription/relay lines price at
 *      the BEHIND model's official tiers, marked `shadow` (订阅线·影子成本)
 *   4. anything else: `unpriced` — cost null, displayed as 未定价.
 *
 * Tiers are USD per 1M tokens, matching the token counts divided by 1e6.
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PriceMode, PriceTiers, PricingModel, PricingResult } from './types.js';
import type { Usage } from './session-parse.js';
import { writeAtomicJson } from './scanner.js';

interface SnapshotModel {
	model: string;
	provider: string | null;
	tiers: PriceTiers | null;
	priceMode: PriceMode;
	sourceUrl: string | null;
	/** Human-readable label for the UI. Falls back to the raw id when absent. */
	displayName: string | null;
}

interface SnapshotFile {
	schemaVersion: number;
	source: string;
	fetchedAt: number | null;
	subscriptionShadowMap: Record<string, string>;
	channelUnitPricesCny: Record<string, number>;
	models: SnapshotModel[];
}

function isFiniteNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

function validateTiers(v: unknown, at: string): PriceTiers | null {
	if (v === null || v === undefined) return null;
	if (typeof v !== 'object') throw new Error(`${at}: tiers must be an object or null`);
	const t = v as Record<string, unknown>;
	const dims = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;
	// A tiers object whose EVERY dimension is null means the model has no price
	// at all (WS4 marks such entries unpriced) — keep tiers null so cost stays
	// null, never 0.
	const allNull = dims.every((k) => t[k] === null || t[k] === undefined);
	if (allNull) return null;
	// Per-dimension null = the provider bills nothing on that dimension (e.g.
	// DeepSeek has no cacheWrite line item) ⇒ 0.
	const dim = (key: string): number => {
		const raw = t[key];
		if (raw === null || raw === undefined) return 0;
		const n = Number(raw);
		if (!Number.isFinite(n) || n < 0) {
			throw new Error(`${at}.tiers.${key}: expected a finite number >= 0 or null, got ${JSON.stringify(raw)}`);
		}
		return n;
	};
	return { input: dim('input'), output: dim('output'), cacheRead: dim('cacheRead'), cacheWrite: dim('cacheWrite') };
}

function parseSnapshot(raw: string, at: string): SnapshotFile {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`${at}: not valid JSON: ${(e as Error).message}`);
	}
	if (parsed === null || typeof parsed !== 'object') throw new Error(`${at}: not an object`);
	const s = parsed as Record<string, unknown>;
	if (s.schemaVersion !== 1) throw new Error(`${at}: unsupported schemaVersion ${JSON.stringify(s.schemaVersion)}`);
	if (!Array.isArray(s.models)) throw new Error(`${at}: models must be an array`);
	const models: SnapshotModel[] = s.models.map((m, i) => {
		if (m === null || typeof m !== 'object') throw new Error(`${at}: models[${i}] is not an object`);
		const mm = m as Record<string, unknown>;
		if (typeof mm.model !== 'string' || mm.model.length === 0) {
			throw new Error(`${at}: models[${i}].model must be a non-empty string`);
		}
		return {
			model: mm.model,
			provider: mm.provider === undefined || mm.provider === null ? null : String(mm.provider),
			tiers: validateTiers(mm.tiers, `${at}: models[${i}]`),
			priceMode: mm.priceMode === undefined ? 'official' : (mm.priceMode as PriceMode),
			sourceUrl: mm.sourceUrl === undefined || mm.sourceUrl === null ? null : String(mm.sourceUrl),
			displayName: mm.displayName === undefined || mm.displayName === null ? null : String(mm.displayName)
		};
	});
	const shadowRaw = s.subscriptionShadowMap;
	const shadow: Record<string, string> = {};
	if (shadowRaw !== null && typeof shadowRaw === 'object') {
		for (const [k, v] of Object.entries(shadowRaw as Record<string, unknown>)) {
			// WS4 ships string | string[] (one relay provider may front several
			// models); the engine resolves per (provider, model) so the array is
			// informational — keep the first id for the no-entry fallback.
			if (typeof v === 'string') shadow[k] = v;
			else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') shadow[k] = v[0];
			else throw new Error(`${at}: subscriptionShadowMap[${JSON.stringify(k)}] must be a model id or id array`);
		}
	}
	const unitRaw = s.channelUnitPricesCny;
	const unit: Record<string, number> = {};
	if (unitRaw !== null && typeof unitRaw === 'object') {
		for (const [k, v] of Object.entries(unitRaw as Record<string, unknown>)) {
			if (!isFiniteNumber(v)) throw new Error(`${at}: channelUnitPricesCny[${JSON.stringify(k)}] must be a number`);
			unit[k] = v;
		}
	}
	return {
		schemaVersion: 1,
		source: typeof s.source === 'string' ? s.source : 'unknown',
		fetchedAt: isFiniteNumber(s.fetchedAt)
			? (s.fetchedAt as number)
			: typeof s.fetchedAt === 'string' && !Number.isNaN(Date.parse(s.fetchedAt))
				? Date.parse(s.fetchedAt)
				: null,
		subscriptionShadowMap: shadow,
		channelUnitPricesCny: unit,
		models
	};
}

export interface PriceLookup {
	tiers: PriceTiers | null;
	priceMode: PriceMode;
	sourceUrl: string | null;
}

export interface PricedCall {
	cost: number | null;
	priceMode: PriceMode;
}

export class PriceEngine {
	private snapshot: SnapshotFile;
	private community: SnapshotFile | null = null;
	private readonly communityPath: string;

	private constructor(snapshot: SnapshotFile, communityPath: string) {
		this.snapshot = snapshot;
		this.communityPath = communityPath;
	}

	/** Load the built-in snapshot (package data/) and the community cache if present. */
	static async load(snapshotPath: string | undefined, communityPath: string): Promise<PriceEngine> {
		const resolved = snapshotPath ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'prices.snapshot.json');
		const snapshot = parseSnapshot(await fsp.readFile(resolved, 'utf8'), resolved);
		const engine = new PriceEngine(snapshot, communityPath);
		try {
			engine.community = parseSnapshot(await fsp.readFile(communityPath, 'utf8'), communityPath);
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
		}
		return engine;
	}

	/** Channel unit prices (CNY per call) for the ledger's derivedCny. */
	channelUnitPricesCny(): Record<string, number> {
		return this.community?.channelUnitPricesCny ?? this.snapshot.channelUnitPricesCny;
	}

	/**
	 * Resolve the pricing of one (provider, model) pair. Never returns cost 0
	 * for unknown models.
	 *
	 * The curated snapshot is consulted FIRST: it holds vendor-verified prices
	 * that were checked against the official pricing pages. The community cache
	 * is a broad fallback (thousands of aggregator rows) and must not override a
	 * verified entry — otherwise the panel labels an officially-priced model as
	 * 社区源 and prices it at the aggregator's number instead.
	 */
	lookup(provider: string | null, model: string | null): PriceLookup {
		if (model === null) return { tiers: null, priceMode: 'unpriced', sourceUrl: null };
		for (const source of [this.snapshot, this.community]) {
			if (source === null) continue;
			// provider-specific entry wins over any other entry for the same model id
			let exact: SnapshotModel | null = null;
			let any: SnapshotModel | null = null;
			for (const m of source.models) {
				if (m.model !== model) continue;
				if (any === null) any = m;
				if (provider !== null && m.provider === provider) exact = m;
			}
			const hit = exact ?? any;
			if (hit !== null && hit.tiers !== null) {
				return { tiers: hit.tiers, priceMode: hit.priceMode, sourceUrl: hit.sourceUrl };
			}
		}
		// subscription/relay line: price at the behind model's official tiers
		if (provider !== null) {
			const behind = this.snapshot.subscriptionShadowMap[provider] ?? this.community?.subscriptionShadowMap[provider];
			if (behind !== undefined && behind !== model) {
				const shadow = this.lookup(null, behind);
				if (shadow.tiers !== null) return { tiers: shadow.tiers, priceMode: 'shadow', sourceUrl: shadow.sourceUrl };
			}
		}
		return { tiers: null, priceMode: 'unpriced', sourceUrl: null };
	}

	/** Price one call's usage; unpriced ⇒ {cost:null}, never 0. */
	priceCall(usage: Usage, provider: string | null, model: string | null): PricedCall {
		const hit = this.lookup(provider, model);
		if (hit.tiers === null) return { cost: null, priceMode: 'unpriced' };
		const t = hit.tiers;
		const cost =
			(usage.inputTokens / 1e6) * t.input +
			(usage.outputTokens / 1e6) * t.output +
			(usage.cacheReadTokens / 1e6) * t.cacheRead +
			(usage.cacheWriteTokens / 1e6) * t.cacheWrite;
		return { cost, priceMode: hit.priceMode };
	}

	/**
	 * Current catalog view for the `pricing` endpoint.
	 *
	 * Curated snapshot entries come first and win on collision; community rows
	 * only fill in models the snapshot does not cover. Returning just one source
	 * would hide every curated-only model (they are absent from the aggregator
	 * feeds) and would mislabel the curated ones as 社区源.
	 */
	catalog(): PricingResult {
		const toView = (m: SnapshotModel): PricingModel => ({
			model: m.model,
			provider: m.provider ?? null,
			tiers: m.tiers,
			priceMode: m.tiers === null ? 'unpriced' : (m.priceMode ?? 'official'),
			sourceUrl: m.sourceUrl ?? null,
			displayName: m.displayName ?? null
		});
		const byModel = new Map<string, PricingModel>();
		for (const m of this.snapshot.models) byModel.set(m.model, toView(m));
		for (const m of this.community?.models ?? []) {
			if (!byModel.has(m.model)) byModel.set(m.model, toView(m));
		}
		const source =
			this.community === null
				? this.snapshot.source
				: `${this.snapshot.source} + ${this.community.source}`;
		return { fetchedAt: this.community?.fetchedAt ?? this.snapshot.fetchedAt, source, models: [...byModel.values()] };
	}

	/**
	 * Refresh community prices from OpenRouter + LiteLLM (SPEC §4, G1 live
	 * probing belongs to WS4 — the endpoints below are the documented ones;
	 * call failures throw loud, they are never swallowed into stale data).
	 */
	async refreshCommunity(fetchImpl: typeof fetch = fetch): Promise<{ fetchedAt: number; models: number }> {
		const openrouter = normalizeOpenRouter(await (await fetchImpl('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20000) })).json());
		const litellm = normalizeLiteLLM(
			await (
				await fetchImpl('https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json', { signal: AbortSignal.timeout(20000) })
			).json()
		);
		const byModel = new Map<string, SnapshotModel>();
		for (const m of [...litellm, ...openrouter]) byModel.set(m.model, m);
		const file: SnapshotFile = {
			schemaVersion: 1,
			source: 'community (OpenRouter /api/v1/models + LiteLLM model_prices)',
			fetchedAt: Date.now(),
			subscriptionShadowMap: this.snapshot.subscriptionShadowMap,
			channelUnitPricesCny: this.snapshot.channelUnitPricesCny,
			models: [...byModel.values()]
		};		await writeAtomicJson(this.communityPath, file);
		this.community = file;
		return { fetchedAt: file.fetchedAt as number, models: file.models.length };
	}
}

/**
 * OpenRouter /api/v1/models → snapshot models. WS4 probed the live response
 * (reports/price-catalog-research-20260925.md §1): pricing values are strings
 * in USD PER TOKEN — convert to USD/MTok with ×1e6; input_cache_write is null
 * for most models.
 */
export function normalizeOpenRouter(json: unknown): SnapshotModel[] {
	if (json === null || typeof json !== 'object' || !Array.isArray((json as { data?: unknown }).data)) {
		throw new Error('openrouter normalize: response has no data[] array');
	}
	const out: SnapshotModel[] = [];
	for (const entry of (json as { data: unknown[] }).data) {
		if (entry === null || typeof entry !== 'object') continue;
		const e = entry as Record<string, unknown>;
		if (typeof e.id !== 'string') continue;
		const p = e.pricing as Record<string, unknown> | undefined;
		if (p === null || typeof p !== 'object') continue;
		const perMTok = (k: string): number | null => {
			const v = p[k];
			if (v === null || v === undefined) return null;
			const n = Number(v);
			return Number.isFinite(n) && n >= 0 ? n * 1e6 : null;
		};
		const input = perMTok('prompt');
		const output = perMTok('completion');
		if (input === null || output === null) continue;
		out.push({
			model: e.id,
			provider: null,
			tiers: { input, output, cacheRead: perMTok('input_cache_read') ?? 0, cacheWrite: perMTok('input_cache_write') ?? 0 },
			priceMode: 'community',
			sourceUrl: 'https://openrouter.ai/api/v1/models',
			displayName: typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null
		});
	}
	return out;
}

/**
 * LiteLLM model_prices → snapshot models. WS4 probed the live file: cost
 * fields are `input_cost_per_token` / `output_cost_per_token` /
 * `cache_read_input_token_cost` / `cache_write_input_token_cost`, all USD per
 * TOKEN (×1e6 to MTok). The `*_per_million_tokens` spellings some forks use
 * are honored only with their native unit.
 */
export function normalizeLiteLLM(json: unknown): SnapshotModel[] {
	if (json === null || typeof json !== 'object') throw new Error('litellm normalize: response is not an object');
	const out: SnapshotModel[] = [];
	for (const [id, entry] of Object.entries(json as Record<string, unknown>)) {
		if (id === 'sample_spec' || entry === null || typeof entry !== 'object') continue;
		const e = entry as Record<string, unknown>;
		if (e.mode !== 'chat') continue;
		const perToken = (k: string): number | null => {
			const v = e[k];
			if (v === null || v === undefined) return null;
			const n = Number(v);
			return Number.isFinite(n) && n >= 0 ? n * 1e6 : null;
		};
		const perMTokField = (k: string): number | null => {
			const v = e[k];
			if (v === null || v === undefined) return null;
			const n = Number(v);
			return Number.isFinite(n) && n >= 0 ? n : null;
		};
		const input = perToken('input_cost_per_token') ?? perMTokField('input_cost_per_million_tokens');
		const output = perToken('output_cost_per_token') ?? perMTokField('output_cost_per_million_tokens');
		if (input === null || output === null || input === 0) continue;
		out.push({
			model: id,
			provider: typeof e.litellm_provider === 'string' ? e.litellm_provider : null,
			tiers: {
				input,
				output,
				cacheRead: perToken('cache_read_input_token_cost') ?? perMTokField('cache_read_input_cost_per_million_tokens') ?? 0,
				cacheWrite: perToken('cache_write_input_token_cost') ?? perMTokField('cache_write_input_cost_per_million_tokens') ?? 0
			},
			priceMode: 'community',
			sourceUrl: 'https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json',
			displayName: null
		});
	}
	return out;
}
