/**
 * One-shot integrator: convert WS4's research outputs (reports/) into the
 * engine's data/ files. Re-run safe (idempotent overwrite).
 *
 * Decisions encoded here (NOT in the engine):
 *  - channelUnitPricesCny: per-call CNY for the ledger's derivedCny, one
 *    variant per channel — search tier by default, WS4's dual-verified
 *    official values only; channels without a per-call price (zhipu plan
 *    quota, baidu free tier, web_search balance) stay ABSENT = excluded
 *    from derivedCny, never silently zero-priced.
 *  - aliyun uses the CURRENT official ¥0.029 (WS4 dual-source verified);
 *    the local providers.json ¥0.03 is suspected stale — registry fix is a
 *    separate report, not baked here.
 *  - FX for USD channels: 6.722655 (WS4 probe, open.er-api.com 2026-09-24).
 *  - _caveats: human-readable notes the engine does NOT read (gemini-3.8
 *    promo pricing ends 2026-12-31, ×2 from 2027; deepseek-v4.1 alias).
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, '..', 'reports');
const ws4 = JSON.parse(readFileSync(path.join(src, 'prices.snapshot.json'), 'utf8'));
const FX = 6.722655;

const channelUnitPricesCny = {
	kimi: 0.01, // search-basic, official page == registry, dual-verified
	aliyun: 0.029, // lianwang-search-mcp, CURRENT official (registry ¥0.03 suspected stale)
	exa: Math.round(0.007 * FX * 1e5) / 1e5, // search $7/1k → CNY
	firecrawl: Math.round(0.005 * FX * 1e5) / 1e5 // credit-overage $5/1k → CNY
};

const integrated = {
	schemaVersion: 1,
	source: 'WS4 price catalog research 2026-09-25 (official pages + OpenRouter + LiteLLM, evidence reports/probes/)',
	fetchedAt: Date.parse(ws4.fetchedAt),
	currency: ws4.currency,
	subscriptionShadowMap: ws4.subscriptionShadowMap,
	channelUnitPricesCny,
	_caveats: [
		'gemini-3.8-flash 与 gemini-3.8-flash-tiered 为 2026-12-31 前限时价（$0.75/$3.75/$0.075）；2027-01-01 起翻倍至 $1.50/$7.50/$0.15——到期需更新本快照。',
		'deepseek-v4.1（非 flash）官方无此模型名，按 WS4 结论保持 unpriced；如所指为旗舰请改用 deepseek-v4-pro 条目计价。',
		'tiers 内某维度为 null 表示该维度不计费（如 DeepSeek 无 cacheWrite 项），引擎按 0 处理；模型级 unpriced 的 cost 为 null 绝不计 0。',
		'channelUnitPricesCny 仅供 ledger ¥ 折算（每渠道取默认 search 档）；无按次计价的渠道（zhipu 套餐制 / baidu 免费档 / web_search 余额制）不在此表=不计入 derivedCny。'
	],
	models: ws4.models
};

const target = path.join(root, 'data', 'prices.snapshot.json');
writeFileSync(target, JSON.stringify(integrated, null, 2) + '\n', 'utf8');
copyFileSync(path.join(src, 'channel-prices.json'), path.join(root, 'data', 'channel-prices.json'));
console.log(`integrated: ${integrated.models.length} models, ${Object.keys(channelUnitPricesCny).length} channel unit prices, fetchedAt=${integrated.fetchedAt}`);
