/**
 * dsh-usage-panel — client half (browser bundle, served at
 * /plugins/dsh-usage-panel/client.js through the `dsh.client` manifest).
 *
 * Implements the complete tripartite UI according to SPEC §2, §3, §4, §6:
 *   A) sidebar-right main dashboard tab:
 *      - Time range filter (today / week / month / all) with immediate fetch
 *      - 60s auto-polling when 'today' is selected, cleaned up on unmount
 *      - KPI summary cards (Total Tokens, Cost in USD/CNY, Calls, Sessions, Cache Hit %)
 *      - Interactive Daily Timeseries SVG Chart (Tokens / Cost toggle, tooltips)
 *      - Model × Provider breakdown table (with 「订阅线·影子成本」 and 「未定价」 badges)
 *      - Session Top list (subagent derivation rolled up to parent with sub share split)
 *      - Main vs Subagent 3-tier / origin breakdown view
 *      - Cache hit rate efficiency trend
 *      - Call-level detail table (paginated, with Model / Provider / Session ID filters)
 *      - Web-router ledger area (available=false empty state guidance, channel stats + derived CNY)
 *      - Price source footnote (source + fetchedAt + manual refresh button)
 *   B) composer bottom status bar (`conversation.composer.dock`):
 *      - Today tokens + Today ¥, clicking opens sidebar tab
 *   C) permanent dock (`conversation.input.dock`):
 *      - Today / This Month two-metric glanceable pill, clicking opens sidebar tab
 *
 * Design Directive: Apple Design (WWDC fluid design principles)
 *   - Translucent glass surfaces (backdrop-filter blur + saturation)
 *   - Spring-like active scale (0.97) micro-interactions, responsive hover states
 *   - SF Pro / system typography with tabular numerals for all metrics
 *   - Clean hierarchy, optical tracking, restrained elegance
 *   - Theme variables with graceful fallbacks (host light/dark adaptive)
 *   - Fail-loud error handling: endpoint errors ({ ok: false, error }) reject and render
 *     explicit error states, never silent blanks or fake data.
 */

import type {
	BreakdownRow,
	DetailFilters,
	DetailResult,
	DetailRow,
	LedgerChannelRow,
	LedgerResult,
	PriceMode,
	PricingModel,
	PricingResult,
	Range,
	RefreshResult,
	SummaryResult,
	TimeseriesRow
} from './lib/types.js';

(window as any).__ModuleLoader__.load({
	id: 'dsh-usage-panel',
	factory: (require: any) => {
		const module = { exports: {} as any };
		const exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const React = require('react');

		const NS = 'usage-panel';
		const SIDEBAR_TAB_ID = 'dsh-usage-panel';
		const SIDEBAR_TAB_KIND = 'dsh-usage-panel';
		const USD_TO_CNY = 7.23;

	// ─── RPC Helper ─────────────────────────────────────────────────────────────
	// Rides the Connection client's generic-RPC caller over the authenticated
	// /api channel — the same three-argument convention the quota-panel client
	// uses (channel, method, payload). A raw fetch to /api/<method> is NOT a
	// plain HTTP route (404 there); the connection service owns the framing.
	let runtimeCtx: any = null;

	function callRpc<T>(endpoint: string, payload: unknown = {}): Promise<T> {
		const rpc = runtimeCtx?.connection?.rpc;
		if (rpc === null || rpc === undefined || typeof rpc.call !== 'function') {
			return Promise.reject(new Error('RPC transport unavailable: connection.rpc.call missing (host connection service not injected)'));
		}
		return rpc.call('/api', `dsh-usage-panel/${endpoint}`, payload).then((result: any) => {
			if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
				const err = result.error || {};
				throw new Error(`[${err.code || 'endpoint-error'}] ${err.message || 'Unknown RPC error'}`);
			}
			return result as T;
		});
	}

		// ─── Formatters ────────────────────────────────────────────────────────────

		function formatNumber(n: number | null | undefined): string {
			if (n === null || n === undefined || Number.isNaN(n)) return '0';
			return n.toLocaleString('en-US');
		}

		function formatTokens(n: number | null | undefined): string {
			if (n === null || n === undefined || Number.isNaN(n)) return '0';
			if (n < 1000) return String(Math.round(n));
			if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k';
			if (n < 1_000_000_000) return (n / 1_000_000).toFixed(2) + 'M';
			return (n / 1_000_000_000).toFixed(2) + 'B';
		}

		function formatCostUsd(usd: number | null | undefined): string {
			if (usd === null || usd === undefined || Number.isNaN(usd)) return '$0.00';
			if (usd === 0) return '$0.00';
			if (usd < 0.01) return '$' + usd.toFixed(4);
			return '$' + usd.toFixed(2);
		}

		function formatCostCny(usd: number | null | undefined): string {
			if (usd === null || usd === undefined || Number.isNaN(usd)) return '¥0.00';
			const cny = usd * USD_TO_CNY;
			if (cny === 0) return '¥0.00';
			if (cny < 0.01) return '¥' + cny.toFixed(4);
			return '¥' + cny.toFixed(2);
		}

		function formatPercent(ratio: number | null | undefined): string {
			if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '0.0%';
			return (Math.min(Math.max(ratio, 0), 1) * 100).toFixed(1) + '%';
		}

		function formatTimestamp(ts: number | null | undefined): string {
			if (!ts || Number.isNaN(ts)) return '—';
			const d = new Date(ts);
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			const hours = String(d.getHours()).padStart(2, '0');
			const minutes = String(d.getMinutes()).padStart(2, '0');
			const seconds = String(d.getSeconds()).padStart(2, '0');
			return `${month}-${day} ${hours}:${minutes}:${seconds}`;
		}

		function formatShortSession(id: string): string {
			if (!id) return '—';
			if (id.length <= 12) return id;
			return id.slice(0, 6) + '…' + id.slice(-4);
		}

		// ─── i18n Dictionaries ──────────────────────────────────────────────────────

		const DICT = {
			zh: {
				title: '用量与费用',
				guideDescription: '会话级 token 统计、费用核算与路由账本',
				tabTitle: '用量看板',
				rangeToday: '今日',
				rangeWeek: '本周',
				rangeMonth: '本月',
				rangeAll: '全部',
				kpiTotalTokens: '总 Tokens',
				kpiTotalCost: '总估算费用',
				kpiTotalCalls: '模型调用次数',
				kpiSessions: '涉及会话',
				kpiCacheHitRate: 'Cache 命中率',
				kpiInputTokens: '输入 Tokens',
				kpiOutputTokens: '输出 Tokens',
				kpiCacheRead: '缓存读取 (Hit)',
				kpiCacheWrite: '缓存写入',
				kpiCnyApprox: '折合人民币',
				agentSplitTitle: '主 / 子 Agent 资源消耗对比',
				mainAgent: '主会话',
				subAgent: '子 Agent',
				timeseriesTitle: '每日趋势分布',
				toggleTokens: 'Tokens',
				toggleCost: '费用 ($)',
				toggleCalls: '调用量',
				breakdownTitle: '模型 × Provider 分布明细',
				colModel: '模型',
				colProvider: 'Provider / 渠道',
				colTokens: 'Tokens',
				colCost: '费用',
				colCalls: '调用数',
				colCacheHit: 'Cache 命中率',
				colPriceMode: '计价方式',
				badgeShadow: '订阅线·影子成本',
				badgeUnpriced: '未定价',
				badgeOfficial: '官方牌价',
				badgeCommunity: '社区源',
				sessionTopTitle: '会话用量消耗排行 Top',
				sessionSubRollup: '含子 Agent 消耗: {sub}',
				cacheEfficiencyTitle: 'Cache 命中效能',
				cacheEfficiencyDesc: '高效命中缓存能大幅降低延迟并节省输入费用',
				detailsTitle: '调用级实时流水明细',
				filterModelPlaceholder: '筛选模型 (如 gpt-4o, claude)...',
				filterProviderPlaceholder: '筛选 Provider...',
				filterSessionPlaceholder: '筛选 Session ID...',
				colTimestamp: '时间',
				colSessionId: '会话 ID',
				colOrigin: '发起层级',
				colUsageDetail: 'Input / Output / Cache',
				originMain: '主会话',
				originSubagent: '子 Agent',
				pagePrev: '上一页',
				pageNext: '下一页',
				pageIndicator: '第 {page} 页 / 共 {total} 条',
				ledgerTitle: 'Web-Router 路由账本',
				ledgerEmptyTitle: '未检测到路由账本',
				ledgerEmptyDesc: 'web-router 账本将在首次使用联网检索/路由能力后自动生成，支持渠道调用与费用核算。',
				ledgerDerivedCny: '路由折算人民币',
				ledgerTotalCalls: '账本记录调用',
				colChannel: '渠道',
				colCostType: '费用类型',
				colCount: '调用次数',
				colLastTs: '最近记录',
				costFree: '免费通道',
				costQuota: '官方额度',
				costPaid: '实付费',
				pricingFooterTitle: '价格源基准',
				pricingFetchedAt: '更新时间: {time}',
				pricingSource: '来源: {src}',
				btnRefresh: '手动刷新',
				btnRefreshing: '正在刷新…',
				refreshSuccess: '已完成增量重扫与价格刷新 ({files} 文件, 新增 {calls} 次调用)',
				errFailed: '获取统计数据失败: {msg}',
				btnRetry: '重试',
				composerBarToday: '今日用量: {tokens} · {cost}',
				dockPillText: '今 {today} / 月 {month}',
				loadError: '加载失败: {message}',
				clickToOpen: '点击打开统计看板',
				unpricedWarning: '未定价模型绝不按 ¥0 计入，显式标明「未定价」',
				emptyList: '暂无用量记录'
			},
			en: {
				title: 'Token Usage & Cost',
				guideDescription: 'Session-level token statistics, cost derivation & route ledger',
				tabTitle: 'Usage Dashboard',
				rangeToday: 'Today',
				rangeWeek: 'This Week',
				rangeMonth: 'This Month',
				rangeAll: 'All Time',
				kpiTotalTokens: 'Total Tokens',
				kpiTotalCost: 'Total Cost',
				kpiTotalCalls: 'Total Calls',
				kpiSessions: 'Sessions',
				kpiCacheHitRate: 'Cache Hit Rate',
				kpiInputTokens: 'Input Tokens',
				kpiOutputTokens: 'Output Tokens',
				kpiCacheRead: 'Cache Read (Hit)',
				kpiCacheWrite: 'Cache Write',
				kpiCnyApprox: 'CNY Approx.',
				agentSplitTitle: 'Main vs Subagent Split',
				mainAgent: 'Main Session',
				subAgent: 'Subagent',
				timeseriesTitle: 'Daily Trend Distribution',
				toggleTokens: 'Tokens',
				toggleCost: 'Cost ($)',
				toggleCalls: 'Calls',
				breakdownTitle: 'Model × Provider Breakdown',
				colModel: 'Model',
				colProvider: 'Provider',
				colTokens: 'Tokens',
				colCost: 'Cost',
				colCalls: 'Calls',
				colCacheHit: 'Cache Hit',
				colPriceMode: 'Pricing Mode',
				badgeShadow: 'Subscription · Shadow Cost',
				badgeUnpriced: 'Unpriced',
				badgeOfficial: 'Official',
				badgeCommunity: 'Community',
				sessionTopTitle: 'Top Sessions by Usage',
				sessionSubRollup: 'incl. subagent: {sub}',
				cacheEfficiencyTitle: 'Cache Efficiency',
				cacheEfficiencyDesc: 'Prompt cache hits significantly lower latency and cost',
				detailsTitle: 'Call-Level Audit Detail',
				filterModelPlaceholder: 'Filter model...',
				filterProviderPlaceholder: 'Filter provider...',
				filterSessionPlaceholder: 'Filter session ID...',
				colTimestamp: 'Timestamp',
				colSessionId: 'Session ID',
				colOrigin: 'Origin',
				colUsageDetail: 'Input / Output / Cache',
				originMain: 'Main',
				originSubagent: 'Subagent',
				pagePrev: 'Previous',
				pageNext: 'Next',
				pageIndicator: 'Page {page} of {total}',
				ledgerTitle: 'Web-Router Ledger',
				ledgerEmptyTitle: 'No Route Ledger Found',
				ledgerEmptyDesc: 'Web-router ledger records are created when search or routing skills run.',
				ledgerDerivedCny: 'Derived CNY',
				ledgerTotalCalls: 'Ledger Records',
				colChannel: 'Channel',
				colCostType: 'Cost Type',
				colCount: 'Calls',
				colLastTs: 'Last Active',
				costFree: 'Free',
				costQuota: 'Quota',
				costPaid: 'Paid',
				pricingFooterTitle: 'Pricing Source',
				pricingFetchedAt: 'Updated: {time}',
				pricingSource: 'Source: {src}',
				btnRefresh: 'Refresh Now',
				btnRefreshing: 'Refreshing…',
				refreshSuccess: 'Rescanned {files} files, {calls} new calls',
				errFailed: 'Failed to load usage data: {msg}',
				btnRetry: 'Retry',
				composerBarToday: 'Today: {tokens} · {cost}',
				dockPillText: 'Today {today} / Month {month}',
				loadError: 'Load failed: {message}',
				clickToOpen: 'Click to open usage dashboard',
				unpricedWarning: 'Unpriced models are never counted as ¥0',
				emptyList: 'No records available'
			}
		};

		// ─── Apple Design CSS Tokens & Styles ──────────────────────────────────────

		const CSS = `
/* dsh-usage-panel Apple-style fluid UI tokens */
.dup-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 14px 44px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Segoe UI", Roboto, sans-serif;
  color: var(--dsw-text-title, #1D2129);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-text-disabled, #C9CDD4) transparent;
}
.dup-root::-webkit-scrollbar { width: 5px; }
.dup-root::-webkit-scrollbar-thumb { background: var(--dsw-text-disabled, #C9CDD4); border-radius: 3px; }

/* Translucent Glass Card */
.dup-card {
  background: var(--dsw-surface, rgba(255, 255, 255, 0.88));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 120ms ease;
  position: relative;
  overflow: hidden;
}
.dup-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}
.dup-card-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dsw-text-title, #1D2129);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dup-card-title-icon {
  color: var(--dsw-color-primary, #007AFF);
  flex: none;
}

/* iOS Segmented Control */
.dup-segmented {
  display: inline-flex;
  background: var(--dsw-divider, rgba(142, 142, 147, 0.12));
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
  user-select: none;
  -webkit-user-select: none;
}
.dup-segment-btn {
  border: none;
  background: transparent;
  color: var(--dsw-text-tertiary, #86909C);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 160ms cubic-bezier(0.16, 1, 0.3, 1), color 160ms ease, box-shadow 160ms ease;
  text-align: center;
  outline: none;
  white-space: nowrap;
}
.dup-segment-btn:active {
  transform: scale(0.97);
}
.dup-segment-btn.is-active {
  background: var(--dsw-surface, #FFFFFF);
  color: var(--dsw-text-title, #1D2129);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  font-weight: 600;
}

/* KPI Summary Cards Grid */
.dup-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.dup-kpi-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}
.dup-kpi-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dsw-text-tertiary, #86909C);
  margin-bottom: 4px;
}
.dup-kpi-val {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-text-title, #1D2129);
  line-height: 1.2;
}
.dup-kpi-sub {
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dup-kpi-pill {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(0, 122, 255, 0.1);
  color: var(--dsw-color-primary, #007AFF);
}

/* Badges */
.dup-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
}
.dup-badge-shadow {
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
  border: 1px solid rgba(245, 158, 11, 0.28);
}
.dup-badge-unpriced {
  background: rgba(239, 68, 68, 0.12);
  color: #DC2626;
  border: 1px solid rgba(239, 68, 68, 0.28);
  font-weight: 600;
}
.dup-badge-official {
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  border: 1px solid rgba(0, 122, 255, 0.22);
}
.dup-badge-community {
  background: rgba(175, 82, 222, 0.1);
  color: #AF52DE;
  border: 1px solid rgba(175, 82, 222, 0.22);
}
.dup-badge-free {
  background: rgba(52, 199, 89, 0.12);
  color: #28A745;
  border: 1px solid rgba(52, 199, 89, 0.25);
}
.dup-badge-quota {
  background: rgba(0, 122, 255, 0.12);
  color: #007AFF;
  border: 1px solid rgba(0, 122, 255, 0.25);
}
.dup-badge-paid {
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

/* Split Ratio Bar */
.dup-split-bar {
  height: 8px;
  background: var(--dsw-divider, #F2F3F5);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  margin: 10px 0 8px;
}
.dup-split-main {
  background: var(--dsw-color-primary, #007AFF);
  transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dup-split-sub {
  background: #AF52DE;
  transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dup-split-legend {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  font-variant-numeric: tabular-nums;
}

/* SVG Timeseries Chart */
.dup-chart-card {
  display: flex;
  flex-direction: column;
}
.dup-chart-container {
  width: 100%;
  height: 150px;
  position: relative;
  margin-top: 8px;
}
.dup-chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.dup-chart-tooltip {
  position: absolute;
  top: 6px;
  right: 8px;
  background: var(--dsw-surface, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--dsw-text-title, #1D2129);
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

/* Tables & Lists */
.dup-table-wrap {
  width: 100%;
  overflow-x: auto;
  margin-top: 6px;
}
.dup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}
.dup-table th {
  padding: 8px 10px;
  color: var(--dsw-text-tertiary, #86909C);
  font-weight: 500;
  border-bottom: 1px solid var(--dsw-divider, #F2F3F5);
  white-space: nowrap;
}
.dup-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--dsw-divider, #F2F3F5);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-text-body, #4E5969);
  vertical-align: middle;
}
.dup-table tr:hover td {
  background: rgba(0, 122, 255, 0.03);
}

/* Filter inputs */
.dup-filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.dup-input {
  flex: 1 1 120px;
  background: var(--dsw-surface, #FFFFFF);
  border: 1px solid var(--dsw-border, #E5E6EB);
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--dsw-text-title, #1D2129);
  outline: none;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}
.dup-input:focus {
  border-color: var(--dsw-color-primary, #007AFF);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

/* Pagination */
.dup-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--dsw-divider, #F2F3F5);
}
.dup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: var(--dsw-surface, #FFFFFF);
  border: 1px solid var(--dsw-border, #E5E6EB);
  border-radius: 7px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-text-title, #1D2129);
  cursor: pointer;
  transition: all 120ms ease;
  user-select: none;
}
.dup-btn:hover:not(:disabled) {
  background: var(--dsw-divider, #F2F3F5);
}
.dup-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.dup-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dup-btn-primary {
  background: var(--dsw-color-primary, #007AFF);
  border-color: transparent;
  color: #FFFFFF;
}
.dup-btn-primary:hover:not(:disabled) {
  background: #0062CC;
}

/* Empty & Error States */
.dup-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  gap: 6px;
}
.dup-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-text-title, #1D2129);
}
.dup-empty-desc {
  font-size: 12px;
  color: var(--dsw-text-tertiary, #86909C);
  max-width: 320px;
  line-height: 1.5;
}

.dup-error-banner {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 10px 14px;
  color: #DC2626;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* Footnote & Refresh */
.dup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  padding: 6px 2px;
  margin-top: 4px;
  gap: 8px;
}

/* Surface B: Composer Dock Status Bar */
.dup-composer-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: var(--dsw-surface, rgba(255, 255, 255, 0.88));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.1));
  border-radius: 9999px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-text-title, #1D2129);
  cursor: pointer;
  transition: all 120ms ease;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.dup-composer-chip:hover {
  background: rgba(0, 122, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.35);
  color: var(--dsw-color-primary, #007AFF);
}
.dup-composer-chip:active {
  transform: scale(0.96);
}

/* Surface C: Input Permanent Dock Pill */
.dup-dock-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  background: var(--dsw-surface, rgba(255, 255, 255, 0.75));
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-text-body, #4E5969);
  cursor: pointer;
  transition: all 120ms ease;
  user-select: none;
}
.dup-dock-pill:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--dsw-text-title, #1D2129);
}
.dup-dock-pill:active {
  transform: scale(0.96);
}

/* Spinning animation */
@keyframes dup-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.dup-spinning {
  display: inline-block;
  animation: dup-spin 1s linear infinite;
}
`;

		// ─── SVG Icons ─────────────────────────────────────────────────────────────

		function IconMeter() {
			return React.createElement(
				'svg',
				{ width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
				React.createElement('path', { d: 'M12 2v4' }),
				React.createElement('path', { d: 'm4.93 4.93 2.83 2.83' }),
				React.createElement('path', { d: 'M2 12h4' }),
				React.createElement('path', { d: 'm4.93 19.07 2.83-2.83' }),
				React.createElement('path', { d: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z' }),
				React.createElement('path', { d: 'm14 10-2 2' })
			);
		}

		function IconBolt() {
			return React.createElement(
				'svg',
				{ width: 13, height: 13, viewBox: '0 0 24 24', fill: 'currentColor' },
				React.createElement('path', { d: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' })
			);
		}

		function IconRefresh(props: { spinning?: boolean }) {
			return React.createElement(
				'svg',
				{
					width: 13,
					height: 13,
					viewBox: '0 0 24 24',
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 2,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					className: props.spinning ? 'dup-spinning' : ''
				},
				React.createElement('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
				React.createElement('path', { d: 'M3 3v5h5' }),
				React.createElement('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }),
				React.createElement('path', { d: 'M16 21h5v-5' })
			);
		}

		function IconRouter() {
			return React.createElement(
				'svg',
				{ width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
				React.createElement('rect', { width: 20, height: 8, x: 2, y: 14, rx: 2 }),
				React.createElement('path', { d: 'M6.01 18H6' }),
				React.createElement('path', { d: 'M10.01 18H10' }),
				React.createElement('path', { d: 'M15 10v4' }),
				React.createElement('path', { d: 'M17.84 7.17a4 4 0 0 0-5.66 0' }),
				React.createElement('path', { d: 'M20.66 4.34a8 8 0 0 0-11.32 0' })
			);
		}

		// ─── Component: Price Mode Badge ───────────────────────────────────────────

		function PriceModeBadge(props: { mode: PriceMode; t: (key: string) => string }) {
			const { mode, t } = props;
			if (mode === 'shadow') {
				return React.createElement('span', { className: 'dup-badge dup-badge-shadow' }, t('badgeShadow'));
			}
			if (mode === 'unpriced') {
				return React.createElement('span', { className: 'dup-badge dup-badge-unpriced' }, t('badgeUnpriced'));
			}
			if (mode === 'community') {
				return React.createElement('span', { className: 'dup-badge dup-badge-community' }, t('badgeCommunity'));
			}
			return React.createElement('span', { className: 'dup-badge dup-badge-official' }, t('badgeOfficial'));
		}

		// ─── Component: Interactive Timeseries SVG Chart ───────────────────────────

		function TimeseriesChart(props: { rows: TimeseriesRow[]; t: (key: string) => string }) {
			const { rows, t } = props;
			const [metric, setMetric] = React.useState('tokens' as 'tokens' | 'cost' | 'calls');
			const [hoveredIdx, setHoveredIdx] = React.useState(null as number | null);

			if (!rows || rows.length === 0) {
				return React.createElement('div', { className: 'dup-empty-desc', style: { padding: '20px 0', textAlign: 'center' } }, t('emptyList'));
			}

			const values = rows.map((r: TimeseriesRow) => {
				if (metric === 'tokens') return r.tokens;
				if (metric === 'cost') return r.cost;
				return r.calls;
			});
			const maxVal = Math.max(...values, 1);
			const width = 340;
			const height = 120;
			const paddingX = 14;
			const paddingY = 16;
			const chartW = width - paddingX * 2;
			const chartH = height - paddingY * 2;

			const points = rows.map((r, i) => {
				const x = rows.length > 1 ? paddingX + (i / (rows.length - 1)) * chartW : width / 2;
				const val = metric === 'tokens' ? r.tokens : metric === 'cost' ? r.cost : r.calls;
				const y = height - paddingY - (val / maxVal) * chartH;
				return { x, y, row: r, val };
			});

			let pathD = '';
			let areaD = '';
			if (points.length > 0) {
				pathD = `M ${points[0].x} ${points[0].y}`;
				for (let i = 1; i < points.length; i++) {
					// Catmull-Rom or smooth cubic curve
					const prev = points[i - 1];
					const curr = points[i];
					const midX = (prev.x + curr.x) / 2;
					pathD += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
				}
				const lastP = points[points.length - 1];
				const firstP = points[0];
				areaD = `${pathD} L ${lastP.x} ${height - paddingY} L ${firstP.x} ${height - paddingY} Z`;
			}

			const hoveredPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

			return React.createElement(
				'div',
				{ className: 'dup-card dup-chart-card' },
				React.createElement(
					'div',
					{ className: 'dup-card-header' },
					React.createElement('span', { className: 'dup-card-title' }, t('timeseriesTitle')),
					React.createElement(
						'div',
						{ className: 'dup-segmented' },
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (metric === 'tokens' ? ' is-active' : ''),
								onClick: () => setMetric('tokens')
							},
							t('toggleTokens')
						),
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (metric === 'cost' ? ' is-active' : ''),
								onClick: () => setMetric('cost')
							},
							t('toggleCost')
						),
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (metric === 'calls' ? ' is-active' : ''),
								onClick: () => setMetric('calls')
							},
							t('toggleCalls')
						)
					)
				),
				React.createElement(
					'div',
					{ className: 'dup-chart-container' },
					hoveredPoint &&
						React.createElement(
							'div',
							{ className: 'dup-chart-tooltip' },
							React.createElement('strong', null, hoveredPoint.row.date),
							' : ',
							metric === 'tokens' ? formatTokens(hoveredPoint.val) : metric === 'cost' ? formatCostUsd(hoveredPoint.val) : formatNumber(hoveredPoint.val) + ' 次'
						),
					React.createElement(
						'svg',
						{ className: 'dup-chart-svg', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' },
						React.createElement(
							'defs',
							null,
							React.createElement(
								'linearGradient',
								{ id: 'dup-area-grad', x1: '0', y1: '0', x2: '0', y2: '1' },
								React.createElement('stop', { offset: '0%', stopColor: '#007AFF', stopOpacity: '0.28' }),
								React.createElement('stop', { offset: '100%', stopColor: '#007AFF', stopOpacity: '0.01' })
							)
						),
						// Baseline
						React.createElement('line', {
							x1: paddingX,
							y1: height - paddingY,
							x2: width - paddingX,
							y2: height - paddingY,
							stroke: 'rgba(0,0,0,0.06)',
							strokeWidth: 1
						}),
						// Area fill
						areaD && React.createElement('path', { d: areaD, fill: 'url(#dup-area-grad)' }),
						// Line stroke
						pathD && React.createElement('path', { d: pathD, fill: 'none', stroke: '#007AFF', strokeWidth: 2.2, strokeLinecap: 'round' }),
						// Points
						points.map((p, idx) =>
							React.createElement('circle', {
								key: idx,
								cx: p.x,
								cy: p.y,
								r: hoveredIdx === idx ? 5 : 3,
								fill: hoveredIdx === idx ? '#007AFF' : '#FFFFFF',
								stroke: '#007AFF',
								strokeWidth: 2,
								style: { cursor: 'pointer', transition: 'r 120ms ease' },
								onMouseEnter: () => setHoveredIdx(idx),
								onMouseLeave: () => setHoveredIdx(null)
							})
						)
					)
				)
			);
		}

		// ─── Surface A: Main Sidebar Dashboard Tab ──────────────────────────────────

		function UsageSidebarTab(props: { t: (key: string, vars?: Record<string, unknown>) => string; sessionId?: string }) {
			const { t } = props;

			const [range, setRange] = React.useState('today' as Range);
			const [summary, setSummary] = React.useState(null as SummaryResult | null);
			const [timeseries, setTimeseries] = React.useState([] as TimeseriesRow[]);
			const [modelBreakdown, setModelBreakdown] = React.useState([] as BreakdownRow[]);
			const [sessionBreakdown, setSessionBreakdown] = React.useState([] as BreakdownRow[]);
			const [details, setDetails] = React.useState(null as DetailResult | null);
			const [pricing, setPricing] = React.useState(null as PricingResult | null);
			const [ledger, setLedger] = React.useState(null as LedgerResult | null);

			const [loading, setLoading] = React.useState(true);
			const [error, setError] = React.useState(null as string | null);
			const [refreshing, setRefreshing] = React.useState(false);
			const [refreshBanner, setRefreshBanner] = React.useState(null as string | null);

			// Detail table filter states
			const [filterModel, setFilterModel] = React.useState('');
			const [filterProvider, setFilterProvider] = React.useState('');
			const [filterSessionId, setFilterSessionId] = React.useState('');
			const [page, setPage] = React.useState(1);

			// Fetch all data for current range
			const loadAllData = React.useCallback(
				(silent = false) => {
					if (!silent) setLoading(true);
					setError(null);

					const filters: DetailFilters = {};
					if (filterModel.trim()) filters.model = filterModel.trim();
					if (filterProvider.trim()) filters.provider = filterProvider.trim();
					if (filterSessionId.trim()) filters.sessionId = filterSessionId.trim();

					Promise.all([
						callRpc<SummaryResult>('summary', { range }),
						callRpc<TimeseriesRow[]>('timeseries', { range, bucket: 'day' }),
						callRpc<BreakdownRow[]>('breakdown', { range, by: 'model' }),
						callRpc<BreakdownRow[]>('breakdown', { range, by: 'session' }),
						callRpc<DetailResult>('detail', { range, filters, page, pageSize: 20 }),
						callRpc<PricingResult>('pricing', {}),
						callRpc<LedgerResult>('ledger', {})
					])
						.then(([s, ts, mb, sb, dt, pr, lg]) => {
							setSummary(s);
							setTimeseries(ts);
							setModelBreakdown(mb);
							setSessionBreakdown(sb);
							setDetails(dt);
							setPricing(pr);
							setLedger(lg);
							setLoading(false);
						})
						.catch((err: any) => {
							setError(err?.message || String(err));
							setLoading(false);
						});
				},
				[range, filterModel, filterProvider, filterSessionId, page]
			);

			// Immediate fetch on change
			React.useEffect(() => {
				loadAllData();
			}, [loadAllData]);

			// 60s polling for today's metrics
			React.useEffect(() => {
				if (range !== 'today') return;
				const timer = setInterval(() => {
					loadAllData(true);
				}, 60000);
				return () => clearInterval(timer);
			}, [range, loadAllData]);

			// Manual refresh handler
			const handleManualRefresh = () => {
				setRefreshing(true);
				setRefreshBanner(null);
				callRpc<RefreshResult>('refresh', { prices: true })
					.then((res) => {
						setRefreshing(false);
						setRefreshBanner(t('refreshSuccess', { files: res.rescannedFiles, calls: res.newCalls }));
						loadAllData(true);
					})
					.catch((err: any) => {
						setRefreshing(false);
						setError(err?.message || String(err));
					});
			};

			return React.createElement(
				'div',
				{ className: 'dup-root' },

				// 1. Top Controls Bar: Time Filter
				React.createElement(
					'div',
					{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
					React.createElement(
						'div',
						{ className: 'dup-segmented' },
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (range === 'today' ? ' is-active' : ''),
								onClick: () => {
									setRange('today');
									setPage(1);
								}
							},
							t('rangeToday')
						),
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (range === 'week' ? ' is-active' : ''),
								onClick: () => {
									setRange('week');
									setPage(1);
								}
							},
							t('rangeWeek')
						),
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (range === 'month' ? ' is-active' : ''),
								onClick: () => {
									setRange('month');
									setPage(1);
								}
							},
							t('rangeMonth')
						),
						React.createElement(
							'button',
							{
								type: 'button',
								className: 'dup-segment-btn' + (range === 'all' ? ' is-active' : ''),
								onClick: () => {
									setRange('all');
									setPage(1);
								}
							},
							t('rangeAll')
						)
					),
					React.createElement(
						'button',
						{
							type: 'button',
							className: 'dup-btn',
							onClick: handleManualRefresh,
							disabled: refreshing,
							title: t('btnRefresh')
						},
						React.createElement(IconRefresh, { spinning: refreshing }),
						refreshing ? t('btnRefreshing') : t('btnRefresh')
					)
				),

				// Loading indicator
				loading &&
					React.createElement(
						'div',
						{
							style: {
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '10px 0',
								color: 'var(--dsw-text-tertiary, #86909C)',
								fontSize: '12px',
								gap: '6px'
							}
						},
						React.createElement(IconRefresh, { spinning: true }),
						React.createElement('span', null, t('loading'))
					),

				// Error banner if any
				error &&
					React.createElement(
						'div',
						{ className: 'dup-error-banner' },
						React.createElement('span', null, t('errFailed', { msg: error })),
						React.createElement(
							'button',
							{ type: 'button', className: 'dup-btn', onClick: () => loadAllData() },
							t('btnRetry')
						)
					),

				// Refresh banner feedback
				refreshBanner &&
					React.createElement(
						'div',
						{
							style: {
								background: 'rgba(52, 199, 89, 0.1)',
								border: '1px solid rgba(52, 199, 89, 0.25)',
								borderRadius: '8px',
								padding: '8px 12px',
								color: '#28A745',
								fontSize: '12px'
							}
						},
						refreshBanner
					),

				// 2. KPI Summary Cards Grid
				summary &&
					React.createElement(
						'div',
						{ className: 'dup-kpi-grid' },
						// Total Tokens
						React.createElement(
							'div',
							{ className: 'dup-card dup-kpi-card' },
							React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalTokens')),
							React.createElement('span', { className: 'dup-kpi-val' }, formatTokens(summary.tokens.total)),
							React.createElement(
								'span',
								{ className: 'dup-kpi-sub' },
								`In: ${formatTokens(summary.tokens.input)} · Out: ${formatTokens(summary.tokens.output)}`
							)
						),
						// Total Cost
						React.createElement(
							'div',
							{ className: 'dup-card dup-kpi-card' },
							React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalCost')),
							React.createElement('span', { className: 'dup-kpi-val' }, formatCostCny(summary.cost.total)),
							React.createElement(
								'span',
								{ className: 'dup-kpi-sub' },
								`${formatCostUsd(summary.cost.total)} (USD)`
							)
						),
						// Cache Hit Rate
						React.createElement(
							'div',
							{ className: 'dup-card dup-kpi-card' },
							React.createElement('span', { className: 'dup-kpi-label' }, t('kpiCacheHitRate')),
							React.createElement('span', { className: 'dup-kpi-val', style: { color: summary.cacheHitRate > 0.5 ? '#34C759' : undefined } }, formatPercent(summary.cacheHitRate)),
							React.createElement(
								'span',
								{ className: 'dup-kpi-sub' },
								React.createElement('span', { className: 'dup-kpi-pill' }, 'Hit ' + formatTokens(summary.tokens.cacheRead))
							)
						),
						// Total Calls & Sessions
						React.createElement(
							'div',
							{ className: 'dup-card dup-kpi-card' },
							React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalCalls')),
							React.createElement('span', { className: 'dup-kpi-val' }, formatNumber(summary.calls)),
							React.createElement(
								'span',
								{ className: 'dup-kpi-sub' },
								`${t('kpiSessions')}: ${formatNumber(summary.sessions)}`
							)
						)
					),

				// 3. Main vs Subagent Split Card
				summary &&
					summary.mainSub &&
					React.createElement(
						'div',
						{ className: 'dup-card' },
						React.createElement(
							'div',
							{ className: 'dup-card-header' },
							React.createElement('span', { className: 'dup-card-title' }, t('agentSplitTitle'))
						),
						React.createElement(
							'div',
							{ className: 'dup-split-bar' },
							React.createElement('div', {
								className: 'dup-split-main',
								style: {
									width: summary.tokens.total > 0 ? (summary.mainSub.main.tokens / summary.tokens.total) * 100 + '%' : '50%'
								}
							}),
							React.createElement('div', {
								className: 'dup-split-sub',
								style: {
									width: summary.tokens.total > 0 ? (summary.mainSub.subagent.tokens / summary.tokens.total) * 100 + '%' : '50%'
								}
							})
						),
						React.createElement(
							'div',
							{ className: 'dup-split-legend' },
							React.createElement(
								'span',
								null,
								React.createElement('span', { style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#007AFF', marginRight: 4 } }),
								`${t('mainAgent')}: ${formatTokens(summary.mainSub.main.tokens)} (${formatCostCny(summary.mainSub.main.cost)})`
							),
							React.createElement(
								'span',
								null,
								React.createElement('span', { style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#AF52DE', marginRight: 4 } }),
								`${t('subAgent')}: ${formatTokens(summary.mainSub.subagent.tokens)} (${formatCostCny(summary.mainSub.subagent.cost)})`
							)
						)
					),

				// 4. Daily Timeseries Trend Chart
				React.createElement(TimeseriesChart, { rows: timeseries, t }),

				// 5. Model × Provider Breakdown Table
				React.createElement(
					'div',
					{ className: 'dup-card' },
					React.createElement(
						'div',
						{ className: 'dup-card-header' },
						React.createElement('span', { className: 'dup-card-title' }, t('breakdownTitle'))
					),
					modelBreakdown.length === 0
						? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
						: React.createElement(
								'div',
								{ className: 'dup-table-wrap' },
								React.createElement(
									'table',
									{ className: 'dup-table' },
									React.createElement(
										'thead',
										null,
										React.createElement(
											'tr',
											null,
											React.createElement('th', null, t('colModel')),
											React.createElement('th', null, t('colTokens')),
											React.createElement('th', null, t('colCost')),
											React.createElement('th', null, t('colCalls')),
											React.createElement('th', null, t('colCacheHit'))
										)
									),
									React.createElement(
										'tbody',
										null,
										modelBreakdown.map((row: BreakdownRow) => {
											// Check price mode against pricing models if present
											const pricingEntry = pricing?.models?.find((m: PricingModel) => m.model === row.key);
											const mode = pricingEntry ? pricingEntry.priceMode : row.cost === 0 && row.tokens > 0 ? 'unpriced' : 'official';

											return React.createElement(
												'tr',
												{ key: row.key },
												React.createElement(
													'td',
													{ style: { fontWeight: 600 } },
													React.createElement('div', null, row.key),
													React.createElement(
														'div',
														{ style: { marginTop: 3 } },
														React.createElement(PriceModeBadge, { mode, t })
													)
												),
												React.createElement('td', null, formatTokens(row.tokens)),
												React.createElement(
													'td',
													null,
													mode === 'unpriced'
														? React.createElement('span', { className: 'dup-badge dup-badge-unpriced' }, t('badgeUnpriced'))
														: formatCostCny(row.cost)
												),
												React.createElement('td', null, formatNumber(row.calls)),
												React.createElement('td', null, formatPercent(row.cacheHitRate))
											);
										})
									)
								)
						  )
				),

				// 6. Session Top List (with subagent rollup)
				React.createElement(
					'div',
					{ className: 'dup-card' },
					React.createElement(
						'div',
						{ className: 'dup-card-header' },
						React.createElement('span', { className: 'dup-card-title' }, t('sessionTopTitle'))
					),
					sessionBreakdown.length === 0
						? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
						: React.createElement(
								'div',
								{ className: 'dup-table-wrap' },
								React.createElement(
									'table',
									{ className: 'dup-table' },
									React.createElement(
										'thead',
										null,
										React.createElement(
											'tr',
											null,
											React.createElement('th', null, t('colSessionId')),
											React.createElement('th', null, t('colTokens')),
											React.createElement('th', null, t('colCost')),
											React.createElement('th', null, t('colCalls'))
										)
									),
									React.createElement(
										'tbody',
										null,
										sessionBreakdown.slice(0, 8).map((row: BreakdownRow) =>
											React.createElement(
												'tr',
												{ key: row.key },
												React.createElement(
													'td',
													null,
													React.createElement('div', { style: { fontFamily: 'monospace', fontWeight: 600 } }, row.sessionMeta?.title || formatShortSession(row.key)),
													row.sub && row.sub > 0
														? React.createElement(
																'div',
																{ style: { fontSize: '11px', color: '#AF52DE', marginTop: 2 } },
																t('sessionSubRollup', { sub: formatTokens(row.sub) })
														  )
														: null
												),
												React.createElement('td', null, formatTokens(row.tokens)),
												React.createElement('td', null, formatCostCny(row.cost)),
												React.createElement('td', null, formatNumber(row.calls))
											)
										)
									)
								)
						  )
				),

				// 7. Call-level Audit Detail Table (Paginated + Filtered)
				React.createElement(
					'div',
					{ className: 'dup-card' },
					React.createElement(
						'div',
						{ className: 'dup-card-header' },
						React.createElement('span', { className: 'dup-card-title' }, t('detailsTitle'))
					),
					// Filters
					React.createElement(
						'div',
						{ className: 'dup-filter-row' },
						React.createElement('input', {
							type: 'text',
							className: 'dup-input',
							placeholder: t('filterModelPlaceholder'),
							value: filterModel,
							onChange: (e: any) => {
								setFilterModel(e.target.value);
								setPage(1);
							}
						}),
						React.createElement('input', {
							type: 'text',
							className: 'dup-input',
							placeholder: t('filterProviderPlaceholder'),
							value: filterProvider,
							onChange: (e: any) => {
								setFilterProvider(e.target.value);
								setPage(1);
							}
						}),
						React.createElement('input', {
							type: 'text',
							className: 'dup-input',
							placeholder: t('filterSessionPlaceholder'),
							value: filterSessionId,
							onChange: (e: any) => {
								setFilterSessionId(e.target.value);
								setPage(1);
							}
						})
					),
					// Detail rows
					!details || details.rows.length === 0
						? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
						: React.createElement(
								'div',
								{ className: 'dup-table-wrap' },
								React.createElement(
									'table',
									{ className: 'dup-table' },
									React.createElement(
										'thead',
										null,
										React.createElement(
											'tr',
											null,
											React.createElement('th', null, t('colTimestamp')),
											React.createElement('th', null, t('colModel')),
											React.createElement('th', null, t('colOrigin')),
											React.createElement('th', null, t('colUsageDetail')),
											React.createElement('th', null, t('colCost'))
										)
									),
									React.createElement(
										'tbody',
										null,
										details.rows.map((r: DetailRow, idx: number) =>
											React.createElement(
												'tr',
												{ key: r.ts + '-' + idx },
												React.createElement('td', { style: { whiteSpace: 'nowrap' } }, formatTimestamp(r.ts)),
												React.createElement(
													'td',
													null,
													React.createElement('div', { style: { fontWeight: 600 } }, r.model || '—'),
													React.createElement(
														'div',
														{ style: { fontSize: '11px', color: 'var(--dsw-text-tertiary, #86909C)' } },
														r.provider || ''
													)
												),
												React.createElement(
													'td',
													null,
													React.createElement(
														'span',
														{
															className: 'dup-badge',
															style: {
																background: r.origin === 'subagent' ? 'rgba(175,82,222,0.1)' : 'rgba(0,122,255,0.1)',
																color: r.origin === 'subagent' ? '#AF52DE' : '#007AFF'
															}
														},
														r.origin === 'subagent' ? t('originSubagent') : t('originMain')
													)
												),
												React.createElement(
													'td',
													null,
													React.createElement(
														'div',
														null,
														`${formatTokens(r.usage.input)} / ${formatTokens(r.usage.output)}`
													),
													r.usage.cacheRead > 0 &&
														React.createElement(
															'div',
															{ style: { fontSize: '10px', color: '#34C759' } },
															`Hit: ${formatTokens(r.usage.cacheRead)}`
														)
												),
												React.createElement(
													'td',
													null,
													r.priceMode === 'unpriced' || r.cost === null
														? React.createElement('span', { className: 'dup-badge dup-badge-unpriced' }, t('badgeUnpriced'))
														: React.createElement(
																'div',
																null,
																React.createElement('div', null, formatCostCny(r.cost)),
																r.priceMode === 'shadow' && React.createElement(PriceModeBadge, { mode: 'shadow', t })
														  )
												)
											)
										)
									)
								),
								// Pagination footer
								React.createElement(
									'div',
									{ className: 'dup-pagination' },
									React.createElement(
										'button',
										{
											type: 'button',
											className: 'dup-btn',
											disabled: page <= 1,
											onClick: () => setPage((p: number) => Math.max(1, p - 1))
										},
										t('pagePrev')
									),
									React.createElement(
										'span',
										{ style: { fontSize: '12px', color: 'var(--dsw-text-tertiary, #86909C)' } },
										t('pageIndicator', { page, total: details.total })
									),
									React.createElement(
										'button',
										{
											type: 'button',
											className: 'dup-btn',
											disabled: page * details.pageSize >= details.total,
											onClick: () => setPage((p: number) => p + 1)
										},
										t('pageNext')
									)
								)
						  )
				),

				// 8. Web-Router Ledger Area
				React.createElement(
					'div',
					{ className: 'dup-card' },
					React.createElement(
						'div',
						{ className: 'dup-card-header' },
						React.createElement(
							'span',
							{ className: 'dup-card-title' },
							React.createElement(IconRouter),
							t('ledgerTitle')
						),
						ledger && ledger.available && React.createElement('span', { className: 'dup-kpi-pill' }, `${t('ledgerDerivedCny')}: ¥${ledger.derivedCny.toFixed(2)}`)
					),
					!ledger || !ledger.available
						? React.createElement(
								'div',
								{ className: 'dup-empty-card' },
								React.createElement('div', { className: 'dup-empty-title' }, t('ledgerEmptyTitle')),
								React.createElement('div', { className: 'dup-empty-desc' }, t('ledgerEmptyDesc'))
						  )
						: React.createElement(
								'div',
								{ className: 'dup-table-wrap' },
								React.createElement(
									'table',
									{ className: 'dup-table' },
									React.createElement(
										'thead',
										null,
										React.createElement(
											'tr',
											null,
											React.createElement('th', null, t('colChannel')),
											React.createElement('th', null, t('colCostType')),
											React.createElement('th', null, t('colCount')),
											React.createElement('th', null, t('colLastTs'))
										)
									),
									React.createElement(
										'tbody',
										null,
										ledger.byChannel.map((ch: LedgerChannelRow, idx: number) =>
											React.createElement(
												'tr',
												{ key: ch.channel + '-' + ch.costType + '-' + idx },
												React.createElement('td', { style: { fontWeight: 600 } }, ch.channel),
												React.createElement(
													'td',
													null,
													React.createElement(
														'span',
														{
															className: 'dup-badge ' + (ch.costType === 'free' ? 'dup-badge-free' : ch.costType === 'quota' ? 'dup-badge-quota' : 'dup-badge-paid')
														},
														ch.costType === 'free' ? t('costFree') : ch.costType === 'quota' ? t('costQuota') : t('costPaid')
													)
												),
												React.createElement('td', null, formatNumber(ch.counts)),
												React.createElement('td', null, formatTimestamp(ch.lastTs))
											)
										)
									)
								)
						  )
				),

				// 9. Pricing Footnote & Metadata
				pricing &&
					React.createElement(
						'div',
						{ className: 'dup-footer' },
						React.createElement(
							'span',
							null,
							t('pricingSource', { src: pricing.source }),
							pricing.fetchedAt ? ' · ' + t('pricingFetchedAt', { time: formatTimestamp(pricing.fetchedAt) }) : ''
						),
						React.createElement(
							'span',
							{ style: { fontStyle: 'italic', opacity: 0.8 } },
							t('unpricedWarning')
						)
					)
			);
		}

		// ─── Surface B: Composer Bottom Status Bar ──────────────────────────────────

		function ComposerStatusBar(props: { t: (key: string, vars?: Record<string, unknown>) => string; ctx: any }) {
			const { t, ctx } = props;
			const [summary, setSummary] = React.useState(null as SummaryResult | null);
			const [error, setError] = React.useState(null as string | null);

			const fetchSummary = React.useCallback(() => {
				callRpc<SummaryResult>('summary', { range: 'today' })
					.then((value) => {
						setSummary(value);
						setError(null);
					})
					.catch((err: unknown) => {
						// Fail loud in the surface, never render a fake zero: the chip
						// shows — and the tooltip carries the reason.
						const message = String((err as Error | null)?.message ?? err);
						setError(message);
						console.error('usage-panel composer status bar: summary fetch failed:', message);
					});
			}, []);

			React.useEffect(() => {
				fetchSummary();
				const timer = setInterval(fetchSummary, 60000);
				return () => clearInterval(timer);
			}, [fetchSummary]);

			const tokensStr = summary && error === null ? formatTokens(summary.tokens.total) : '—';
			const costStr = summary && error === null ? formatCostCny(summary.cost.total) : '—';

			const handleClick = () => {
				try {
					ctx.sidebarRight?.openTab(SIDEBAR_TAB_KIND);
				} catch (err) {
					console.error('Failed to open sidebar tab', err);
				}
			};

			return React.createElement(
				'div',
				{
					className: 'dup-composer-chip',
					onClick: handleClick,
					title: error !== null ? t('loadError', { message: error }) : t('clickToOpen')
				},
				React.createElement(IconBolt),
				React.createElement('span', null, t('composerBarToday', { tokens: tokensStr, cost: costStr }))
			);
		}

		// ─── Sidebar Title Component ───────────────────────────────────────────────

		function UsageTabTitle(props: { t: (key: string) => string }) {
			return React.createElement(
				'span',
				{ style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
				React.createElement(IconMeter),
				React.createElement('span', null, props.t ? props.t('tabTitle') : '用量看板')
			);
		}

		// ─── Cordis Client Lifecycle Entry ─────────────────────────────────────────

		const inject = ['slots', 'timer', 'locale', 'sidebarRightTabs', 'sidebarRight'];

		function apply(ctx: any) {
			// Capture the runtime context for callRpc: connection.rpc.call lives
			// on the injected ctx (fork precedent `runtimeCtx = ctx`).
			runtimeCtx = ctx;
			// 1. Inject Stylesheet
			ctx.effect(() => {
				const tag = document.createElement('style');
				tag.dataset.plugin = 'dsh-usage-panel';
				tag.textContent = CSS;
				document.head.append(tag);
				return () => {
					tag.remove();
				};
			}, 'dsh-usage-panel: inject styles');

			// 2. Register i18n copy dictionary
			ctx.effect(() => {
				return ctx.locale.register(NS, DICT);
			}, 'dsh-usage-panel: copy dictionaries');

			const t = ctx.locale.bind(NS);

			// 3. Register Surface A: Right Sidebar Tab (Main Dashboard)
			ctx.inject(['sidebarRightTabs'], (injected: any) => {
				const disposers: Array<() => void> = [];
				const own = (result: any) => {
					if (typeof result === 'function') disposers.push(result);
				};

				try {
					const tabs = injected.sidebarRightTabs;
					if (tabs && typeof tabs.register === 'function') {
						own(
							tabs.register({
								id: SIDEBAR_TAB_ID,
								kind: SIDEBAR_TAB_KIND,
								title: () => t('title'),
								guide: [
									{
										order: 15,
										title: () => t('title'),
										description: () => t('guideDescription'),
										icon: IconMeter
									}
								]
							})
						);

						own(
							injected.slots.inject('sidebar.right.pane.tab', () =>
								injected.slots.register(
									{
										name: 'sidebar.right.pane.tab',
										key: SIDEBAR_TAB_ID,
										locale: NS
									},
									(props: any) => React.createElement(UsageSidebarTab, { ...props, t })
								)
							)
						);

						own(
							injected.slots.inject('sidebar.right.pane.tab.title', () =>
								injected.slots.register(
									{
										name: 'sidebar.right.pane.tab.title',
										key: SIDEBAR_TAB_ID
									},
									() => React.createElement(UsageTabTitle, { t })
								)
							)
						);
					}
				} catch (err) {
					console.error('dsh-usage-panel: sidebar tab registration failed', err);
					for (const dispose of disposers) dispose();
					return;
				}

				return () => {
					for (const dispose of disposers) dispose();
				};
			});

			// 4. Register Surface B: Composer Bottom Status Bar
			ctx.slots.inject('conversation.composer.dock', () =>
				ctx.slots.register(
					{
						name: 'conversation.composer.dock',
						id: 'usage-composer-dock',
						order: 15,
						locale: NS
					},
					() => React.createElement(ComposerStatusBar, { t, ctx })
				)
			);

		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
