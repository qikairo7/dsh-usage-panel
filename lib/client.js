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
window.__ModuleLoader__.load({
    id: 'dsh-usage-panel',
    factory: (require) => {
        const module = { exports: {} };
        const exports = module.exports;
        Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
        const React = require('react');
        const NS = 'usage-panel';
        // USD → CNY 换算系数。必须与价格快照 data/prices.snapshot.json 的
        // `currency` 字段一致：该快照记录「1 USD = 6.722655 CNY，来源
        // open.er-api.com，2026-09-24 快照，证据 reports/probes/fx-usd.json」。
        // 校验方式：DeepSeek 官方原生价 ¥2/百万 token，快照记为 0.2975 USD，
        // 0.2975 × 6.722655 = 2.0000 ✓（用 7.23 会得 2.15，虚高 7.5%）。
        // 快照更新时此处需同步。
        const USD_TO_CNY = 6.722655;
        // ─── RPC Helper ─────────────────────────────────────────────────────────────
        // Plain same-origin HTTP against the host half's own web-server routes —
        // the shipped-plugin pattern (y2zyyr/dsh-token-usage-sidebar
        // `fetch('/token-usage/api/summary')`; LaoYueHanNi/dsh-token-usage
        // `fetch('/token-usage/stats')`). No Connection channel is involved: the
        // earlier `connection.rpc.call('/api', …)` design answered HTTP 404 on this
        // host because no shipped plugin mounts that way.
        const RPC_BASE = '/usage-panel/api';
        function callRpc(endpoint, payload = {}) {
            return fetch(`${RPC_BASE}/${endpoint}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
                body: JSON.stringify(payload ?? {})
            }).then(async (res) => {
                if (!res.ok) {
                    throw new Error(`RPC transport error HTTP ${res.status} (${res.statusText})`);
                }
                const result = (await res.json());
                if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                    const err = (result.error ?? {});
                    throw new Error(`[${err.code ?? 'endpoint-error'}] ${err.message ?? 'Unknown RPC error'}`);
                }
                return result;
            });
        }
        // ─── Formatters ────────────────────────────────────────────────────────────
        function formatNumber(n) {
            if (n === null || n === undefined || Number.isNaN(n))
                return '0';
            return n.toLocaleString('en-US');
        }
        function formatTokens(n) {
            if (n === null || n === undefined || Number.isNaN(n))
                return '0';
            if (n < 1000)
                return String(Math.round(n));
            if (n < 1_000_000)
                return (n / 1000).toFixed(1) + 'k';
            if (n < 1_000_000_000)
                return (n / 1_000_000).toFixed(2) + 'M';
            return (n / 1_000_000_000).toFixed(2) + 'B';
        }
        function formatCostCny(usd) {
            if (usd === null || usd === undefined || Number.isNaN(usd))
                return '¥0.00';
            const cny = usd * USD_TO_CNY;
            if (cny === 0)
                return '¥0.00';
            if (cny < 0.01)
                return '¥' + cny.toFixed(4);
            return '¥' + cny.toFixed(2);
        }
        function formatPercent(ratio) {
            if (ratio === null || ratio === undefined || Number.isNaN(ratio))
                return '0.0%';
            return (Math.min(Math.max(ratio, 0), 1) * 100).toFixed(1) + '%';
        }
        function formatTimestamp(ts) {
            if (!ts || Number.isNaN(ts))
                return '—';
            const d = new Date(ts);
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
        function formatShortSession(id) {
            if (!id)
                return '—';
            if (id.length <= 12)
                return id;
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
                rangeCustom: '自定义',
                customFrom: '开始日期',
                customTo: '结束日期',
                customApply: '应用',
                priceTitle: '价格表（快照）',
                priceUnit: '单价 USD / 百万 Tokens，保存后立即生效',
                priceSaved: '价格已保存并生效',
                priceSaveErr: '保存失败：{message}',
                priceAdd: '＋ 新增模型',
                priceConfirmDelete: '确认删除该模型的价格？删除后该模型按未定价处理。',
                priceDisplayName: '显示名',
                priceModeLabel: '计价',
                priceActions: '操作',
                priceSave: '保存',
                priceCancel: '取消',
                priceEdit: '编辑',
                priceDelete: '删除',
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
                trendTitleToday: '今日趋势',
                trendTitleWeek: '本周趋势',
                trendTitleMonth: '本月趋势',
                trendTitleAll: '全部趋势',
                trendTitleCustom: '趋势分布',
                kpiRealInput: '真实消耗输入',
                kpiRealInputSub: '未缓存输入（缓存命中见命中率卡）',
                legendCostRight: '费用（右轴）',
                providerTitle: 'Provider / 渠道分布明细',
                detailExpandHint: '点击行查看单次调用构成',
                trendModelAll: '全部模型',
                trendModelLabel: '模型',
                legendUncachedInput: '未缓存输入',
                legendCacheRead: '缓存读取（命中）',
                legendCacheWrite: '缓存写入',
                legendOutput: '输出',
                cacheHitLine: '命中率',
                toggleTokens: 'Tokens',
                toggleCost: '费用 (¥)',
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
                rangeCustom: 'Custom',
                customFrom: 'Start date',
                customTo: 'End date',
                customApply: 'Apply',
                priceTitle: 'Price Catalog (snapshot)',
                priceUnit: 'USD per M-Token; takes effect immediately on save',
                priceSaved: 'Prices saved and applied',
                priceSaveErr: 'Save failed: {message}',
                priceAdd: '＋ Add model',
                priceConfirmDelete: 'Delete this model price? The model will be treated as unpriced.',
                priceDisplayName: 'Display name',
                priceModeLabel: 'Pricing',
                priceActions: 'Actions',
                priceSave: 'Save',
                priceCancel: 'Cancel',
                priceEdit: 'Edit',
                priceDelete: 'Delete',
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
                trendTitleToday: 'Today Trend',
                trendTitleWeek: 'This Week Trend',
                trendTitleMonth: 'This Month Trend',
                trendTitleAll: 'All-Time Trend',
                trendTitleCustom: 'Trend Distribution',
                kpiRealInput: 'Fresh Input (uncached)',
                kpiRealInputSub: 'excl. cache hits — see hit-rate card',
                legendCostRight: 'Cost (right axis)',
                providerTitle: 'Provider Breakdown',
                detailExpandHint: 'Click a row for per-call composition',
                trendModelAll: 'All models',
                trendModelLabel: 'Model',
                legendUncachedInput: 'Uncached input',
                legendCacheRead: 'Cache read (hit)',
                legendCacheWrite: 'Cache write',
                legendOutput: 'Output',
                cacheHitLine: 'Hit rate',
                toggleTokens: 'Tokens',
                toggleCost: 'Cost (¥)',
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
  /* Fill the host pane but never force a height the host did not allocate:
     height:100% inside an auto-height parent collapsed the content, and
     overflow-y:auto then produced a second scrollbar. min-height:0
     lets this flex child shrink correctly inside the host's scroller. */
  min-height: 0;
  width: 100%;
  overflow-x: hidden;
}

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
  /* Deliberately NOT overflow:hidden — that clipped long labels and wrapped
     text instead of letting the card grow. Cards size to their content. */
  min-width: 0;
  box-sizing: border-box;
}
/* Header holds a title plus (usually) a segmented control. In a ~300px pane
   the two collided and the title ran under the buttons — allow wrapping and
   let the title shrink instead. */
.dup-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
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
  min-width: 0;
  overflow-wrap: anywhere;
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

/* KPI Summary Cards Grid — auto-fit so a narrow sidebar drops to one column
   instead of squeezing two and clipping the 22px value + long sub-lines. */
.dup-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.dup-kpi-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  /* Long values (large ¥ amounts) shrink/wrap instead of being clipped. */
  overflow-wrap: anywhere;
}
.dup-kpi-sub {
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  overflow-wrap: anywhere;
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
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  font-variant-numeric: tabular-nums;
}
/* Each legend side may shrink and wrap instead of colliding with the other. */
.dup-split-legend > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* SVG Timeseries Chart */
.dup-chart-card {
  display: flex;
  flex-direction: column;
}
.dup-chart-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}
/* Model picker for the trend chart. Full-width so a long model name has room,
   matching the existing filter inputs above the detail table. */
.dup-chart-model-row {
  display: flex;
  align-items: center;
  margin-top: 10px;
}
.dup-chart-model-row .dup-input {
  width: 100%;
  min-width: 0;
  font-size: 12px;
  padding: 5px 8px;
}
/* Composition legend: wraps in a narrow pane instead of overflowing. */
.dup-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
  font-size: 10px;
  color: var(--dsw-text-tertiary, #86909C);
}
.dup-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.dup-legend-item i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: none;
}
/* Expanded per-call composition row in the request log. */
.dup-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 6px 14px;
}
.dup-detail-item {
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
  min-width: 0;
  overflow-wrap: anywhere;
}
.dup-detail-item b {
  display: block;
  font-size: 12px;
  color: var(--dsw-text-primary, #1D2129);
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}
/* The SVG keeps its intrinsic aspect ratio (no preserveAspectRatio="none"),
   so circles stay round and stroke widths stay even at any pane width. */
.dup-chart-svg {
  width: 100%;
  height: auto;
  overflow: visible;
  display: block;
}
/* Sits ABOVE the plot instead of on top of it: reserving its own row means
   the tooltip never covers the line/area it is describing. The row is always
   rendered (empty when nothing is hovered) so the chart never jumps. */
.dup-chart-tooltip {
  position: static;
  align-self: flex-start;
  margin-bottom: 6px;
  min-height: 20px;
  box-sizing: border-box;
  background: var(--dsw-surface, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--dsw-text-title, #1D2129);
  pointer-events: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tables & Lists — the wrapper scrolls horizontally so a narrow pane never
   clips columns; cells keep their own wrapping rules. */
.dup-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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

/* ─── Design system override layer ─────────────────────────────────────
   Generated via ui-ux-pro-max (Minimalism/Swiss, dense-dashboard dials)
   + Apple fluid-interface craft rules. Tokens resolve from the host theme
   first (--dsw-*) and only fall back to fixed values, so light/dark both
   adapt. Later rules win: keep this layer LAST in the literal. */
.dup-root {
  --dup-space-1: 4px;
  --dup-space-2: 8px;
  --dup-space-3: 12px;
  --dup-space-4: 16px;
  --dup-radius: 12px;
  --dup-surface: var(--dsw-surface, #FFFFFF);
  --dup-line: var(--dsw-border, rgba(0, 0, 0, 0.07));
  --dup-ink: var(--dsw-text-title, #1D2129);
  --dup-ink-2: var(--dsw-text-secondary, #4E5969);
  --dup-ink-3: var(--dsw-text-tertiary, #86909C);
  --dup-accent: var(--dsw-color-primary, #007AFF);
  --dup-shadow-1: 0 1px 2px rgba(16, 24, 40, 0.05);
  --dup-shadow-2: 0 6px 16px rgba(16, 24, 40, 0.08);
  display: flex;
  flex-direction: column;
  gap: var(--dup-space-3);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--dup-space-4);
  color: var(--dup-ink);
  font-family: inherit;
}
/* Cards: one quiet surface, hairline border, lift on hover only where it
   is interactive-adjacent. Nothing glows; hierarchy comes from spacing. */
.dup-root .dup-card {
  border-radius: var(--dup-radius);
  border: 1px solid var(--dup-line);
  background: var(--dup-surface);
  box-shadow: var(--dup-shadow-1);
  padding: var(--dup-space-4);
  transition: box-shadow 200ms ease, transform 200ms ease;
}
.dup-root .dup-kpi-card {
  padding: var(--dup-space-3) var(--dup-space-4);
}
/* KPI type scale: big numerals with tightened tracking, small labels with
   relaxed tracking (Apple: tracking is size-specific, never one value). */
.dup-root .dup-kpi-label {
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--dup-ink-3);
}
.dup-root .dup-kpi-val {
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--dup-ink);
}
.dup-root .dup-kpi-sub {
  font-size: 11px;
  color: var(--dup-ink-3);
}
/* Segmented control: quiet track, raised active segment. */
.dup-root .dup-segmented {
  background: var(--dsw-bg-secondary, rgba(0, 0, 0, 0.04));
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
}
.dup-root .dup-segment-btn {
  border-radius: 7px;
  color: var(--dup-ink-2);
  font-size: 12px;
  transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}
.dup-root .dup-segment-btn.is-active {
  background: var(--dup-surface);
  color: var(--dup-accent);
  font-weight: 600;
  box-shadow: var(--dup-shadow-1);
}
/* Buttons and inputs: 8px radius, visible focus ring, press feedback. */
.dup-root .dup-btn,
.dup-root .dup-input {
  border-radius: 8px;
}
.dup-root .dup-btn {
  font-size: 12px;
  transition: background 160ms ease, transform 100ms ease-out;
}
.dup-root .dup-btn:active {
  transform: scale(0.97);
}
.dup-root .dup-segment-btn:active {
  transform: scale(0.97);
}
.dup-root .dup-btn:focus-visible,
.dup-root .dup-input:focus-visible,
.dup-root .dup-segment-btn:focus-visible,
.dup-root .dup-chart-model-row select:focus-visible {
  outline: 2px solid var(--dup-accent);
  outline-offset: 1px;
}
/* Tables: dense rows, hairline dividers, muted header with tracking. */
.dup-root .dup-table th {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dup-ink-3);
  border-bottom: 1px solid var(--dup-line);
}
.dup-root .dup-table td {
  border-bottom: 1px solid var(--dup-line);
  font-variant-numeric: tabular-nums;
}
.dup-root .dup-table tbody tr {
  transition: background 160ms ease;
}
.dup-root .dup-table tbody tr:hover {
  background: var(--dsw-bg-secondary, rgba(0, 0, 0, 0.025));
}
/* Section titles: weight-driven hierarchy, not bigger boxes. */
.dup-root .dup-card-title {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--dup-ink);
}
@media (prefers-reduced-motion: reduce) {
  .dup-root * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  .dup-root .dup-btn:active,
  .dup-root .dup-segment-btn:active {
    transform: none;
  }
}
/* Responsive: model/provider pair shares a row on wide screens only. */
.dup-root .dup-cols {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--dup-space-3);
  min-width: 0;
}
@media (min-width: 1100px) {
  .dup-root .dup-cols {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
@media (max-width: 860px) {
  .dup-root {
    padding: var(--dup-space-3);
    gap: var(--dup-space-2);
  }
  .dup-root .dup-kpi-val {
    font-size: 20px;
  }
  .dup-root .dup-card {
    padding: var(--dup-space-3);
  }
}
/* Custom date-range row and always-scrollable tables. */
.dup-root .dup-custom-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dup-space-2);
}
.dup-root .dup-custom-row .dup-input {
  flex: 0 1 150px;
  min-width: 0;
}
.dup-root .dup-table-wrap {
  overflow-x: auto;
}
/* Price snapshot editor form. */
.dup-price-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--dup-space-2) var(--dup-space-3);
  align-items: end;
}
.dup-price-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 11px;
  color: var(--dsw-text-tertiary, #86909C);
}
.dup-price-field .dup-input {
  font-size: 12px;
  padding: 4px 8px;
}
`;
        // ─── SVG Icons ─────────────────────────────────────────────────────────────
        function IconBolt() {
            return React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'currentColor' }, React.createElement('path', { d: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' }));
        }
        function IconRefresh(props) {
            return React.createElement('svg', {
                width: 13,
                height: 13,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                className: props.spinning ? 'dup-spinning' : ''
            }, React.createElement('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }), React.createElement('path', { d: 'M3 3v5h5' }), React.createElement('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }), React.createElement('path', { d: 'M16 21h5v-5' }));
        }
        function IconRouter() {
            return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('rect', { width: 20, height: 8, x: 2, y: 14, rx: 2 }), React.createElement('path', { d: 'M6.01 18H6' }), React.createElement('path', { d: 'M10.01 18H10' }), React.createElement('path', { d: 'M15 10v4' }), React.createElement('path', { d: 'M17.84 7.17a4 4 0 0 0-5.66 0' }), React.createElement('path', { d: 'M20.66 4.34a8 8 0 0 0-11.32 0' }));
        }
        // ─── Component: Price Mode Badge ───────────────────────────────────────────
        function PriceModeBadge(props) {
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
        function TimeseriesChart(props) {
            const { rows, t, title, models, trendModel, onModelChange, modelNames } = props;
            const [metric, setMetric] = React.useState('tokens');
            const [hoveredIdx, setHoveredIdx] = React.useState(null);
            const selector = React.createElement('div', { className: 'dup-chart-model-row' }, React.createElement('select', {
                className: 'dup-input',
                value: trendModel,
                'aria-label': t('trendModelLabel'),
                onChange: (e) => onModelChange(e.target.value)
            }, React.createElement('option', { value: '' }, t('trendModelAll')), models.map((m) => React.createElement('option', { key: m, value: m }, modelNames[m] || m))));
            if (!rows || rows.length === 0) {
                return React.createElement('div', { className: 'dup-card dup-chart-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, title)), selector, React.createElement('div', { className: 'dup-empty-desc', style: { padding: '20px 0', textAlign: 'center' } }, t('emptyList')));
            }
            // A bucket's token total split by what it actually was: fresh input,
            // cache read (the hit), cache write, and generated output.
            // Series palette lifted verbatim from cc-switch's UsageTrendChart:
            // areas OVERLAP with gradient fills; they are not stacked.
            const series = [
                { key: 'input', label: t('legendUncachedInput'), color: '#3b82f6' },
                { key: 'cacheRead', label: t('legendCacheRead'), color: '#a855f7' },
                { key: 'cacheWrite', label: t('legendCacheWrite'), color: '#f97316' },
                { key: 'output', label: t('legendOutput'), color: '#22c55e' }
            ];
            const composed = metric === 'tokens';
            const totals = rows.map((r) => metric === 'tokens' ? r.tokens : metric === 'cost' ? r.cost : r.calls);
            // Unstacked areas scale the token axis to the largest single series —
            // exactly what Recharts does for an AreaChart without stackId.
            const seriesMax = Math.max(...rows.map((r) => Math.max(r.input, r.cacheRead, r.cacheWrite, r.output)), 1);
            const maxVal = composed ? seriesMax : Math.max(...totals, 1);
            // Catmull-Rom → cubic bézier: Recharts' "monotone" smoothing, close
            // enough visually at this density.
            const smoothPath = (pts) => {
                if (pts.length === 0)
                    return '';
                if (pts.length === 1)
                    return `M ${pts[0].x} ${pts[0].y}`;
                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[i - 1] ?? pts[i];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[i + 2] ?? p2;
                    const t = 0.18;
                    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
                }
                return d;
            };
            const width = 700;
            const height = composed ? 240 : 210;
            const padLeft = 52;
            const padRight = 56;
            const padTop = 10;
            const padBottom = 26;
            const chartW = width - padLeft - padRight;
            const chartH = height - padTop - padBottom;
            const baseY = padTop + chartH;
            const fmtAxis = (v) => {
                if (metric === 'tokens')
                    return formatTokens(v);
                if (metric === 'cost')
                    return formatCostCny(v);
                return formatNumber(v);
            };
            const xs = rows.map((_r, i) => rows.length > 1 ? padLeft + (i / (rows.length - 1)) * chartW : padLeft + chartW / 2);
            // Bars fill the gap between neighbours so adjacent buckets read as a
            // continuous band; a lone bucket gets a legible fixed width.
            const span = rows.length > 1 ? (chartW / rows.length) * 0.62 : 18;
            const yOf = (v) => baseY - (v / maxVal) * chartH;
            const points = rows.map((r, i) => ({
                x: xs[i],
                y: yOf(totals[i]),
                row: r,
                val: totals[i]
            }));
            let pathD = '';
            let areaD = '';
            if (points.length > 1 && !composed) {
                pathD = `M ${points[0].x} ${points[0].y}`;
                for (let i = 1; i < points.length; i++)
                    pathD += ` L ${points[i].x} ${points[i].y}`;
                const lastP = points[points.length - 1];
                areaD = `${pathD} L ${lastP.x} ${baseY} L ${points[0].x} ${baseY} Z`;
            }
            const yTicks = [0, 0.5, 1].map((f) => ({ f, y: baseY - f * chartH, val: maxVal * f }));
            // Show every bucket label while they fit (≤14), then thin to ~7.
            const xLabelIdx = [];
            const labelStep = rows.length <= 14 ? 1 : Math.ceil(rows.length / 7);
            for (let idx = 0; idx < rows.length; idx += labelStep)
                xLabelIdx.push(idx);
            if (xLabelIdx[xLabelIdx.length - 1] !== rows.length - 1)
                xLabelIdx.push(rows.length - 1);
            // Hour buckets key as "YYYY-MM-DD HH:00" — show only the clock time.
            const shortDate = (date) => date.includes(' ') ? date.slice(11, 16) : date.length >= 10 ? date.slice(5) : date;
            const hoveredPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;
            // Dual axis (cc-switch style): the token composition uses the left
            // axis; cost rides a separate right-axis scale as a thin line, so
            // both are visible at once instead of behind a metric toggle.
            const costMax = Math.max(...rows.map((r) => r.cost), 1e-9);
            const costPathD = metric === 'tokens' && rows.length > 1
                ? rows
                    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${baseY - (r.cost / costMax) * chartH}`)
                    .join(' ')
                : '';
            return React.createElement('div', { className: 'dup-card dup-chart-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, title), React.createElement('div', { className: 'dup-segmented' }, React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (metric === 'tokens' ? ' is-active' : ''),
                onClick: () => setMetric('tokens')
            }, t('toggleTokens')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (metric === 'cost' ? ' is-active' : ''),
                onClick: () => setMetric('cost')
            }, t('toggleCost')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (metric === 'calls' ? ' is-active' : ''),
                onClick: () => setMetric('calls')
            }, t('toggleCalls')))), selector, React.createElement('div', { className: 'dup-chart-container' }, 
            // Always rendered so the chart never shifts down when the
            // pointer enters/leaves a data point.
            React.createElement('div', { className: 'dup-chart-tooltip' }, hoveredPoint
                ? composed
                    ? [
                        React.createElement('div', { key: 'h', style: { fontWeight: 600, marginBottom: 4 } }, hoveredPoint.row.date),
                        ...series.map((s) => React.createElement('div', { key: s.key, style: { display: 'flex', alignItems: 'center', gap: 6 } }, React.createElement('i', { style: { width: 6, height: 6, borderRadius: 999, background: s.color, display: 'inline-block' } }), React.createElement('span', null, `${s.label}: ${formatTokens(hoveredPoint.row[s.key] ?? 0)}`))),
                        React.createElement('div', { key: 'c', style: { marginTop: 4, color: '#F43F5E' } }, `费用: ${formatCostCny(hoveredPoint.row.cost)}`)
                    ]
                    : [
                        React.createElement('strong', { key: 'd' }, hoveredPoint.row.date),
                        ' : ',
                        metric === 'cost' ? formatCostCny(hoveredPoint.val) : formatNumber(hoveredPoint.val) + ' 次'
                    ]
                : ''), React.createElement('svg', { className: 'dup-chart-svg', viewBox: `0 0 ${width} ${height}` }, React.createElement('defs', null, series.map((s) => React.createElement('linearGradient', { id: `dup-grad-${s.key}`, key: s.key, x1: '0', y1: '0', x2: '0', y2: '1' }, React.createElement('stop', { offset: '5%', stopColor: s.color, stopOpacity: '0.2' }), React.createElement('stop', { offset: '95%', stopColor: s.color, stopOpacity: '0' })))), 
            // Y gridlines + value labels (0 / mid / max)
            yTicks.map((t, idx) => React.createElement('g', { key: `y${idx}` }, React.createElement('line', {
                x1: padLeft,
                y1: t.y,
                x2: width - padRight,
                y2: t.y,
                stroke: 'rgba(0,0,0,0.08)',
                strokeDasharray: '3 3',
                strokeWidth: 1
            }), React.createElement('text', {
                x: padLeft - 6,
                y: t.y + 3,
                textAnchor: 'end',
                fontSize: 9,
                fill: '#86909C'
            }, fmtAxis(t.val)))), 
            // Area fill
            composed
                ? [
                    // cc-switch style: four overlapping smooth gradient areas.
                    series.map((s) => {
                        const pts = rows.map((r, i) => ({
                            x: xs[i],
                            y: baseY - ((r[s.key] ?? 0) / maxVal) * chartH
                        }));
                        const line = smoothPath(pts);
                        const area = pts.length > 1 ? `${line} L ${xs[xs.length - 1]} ${baseY} L ${xs[0]} ${baseY} Z` : '';
                        return React.createElement('g', { key: s.key }, area ? React.createElement('path', { d: area, fill: `url(#dup-grad-${s.key})`, stroke: 'none' }) : null, React.createElement('path', {
                            d: line,
                            fill: 'none',
                            stroke: s.color,
                            strokeWidth: 2,
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round'
                        }));
                    }),
                    // Invisible full-height hit targets: one per bucket, so hover
                    // works across the whole plot on touch/trackpads.
                    rows.map((_r, i) => React.createElement('rect', {
                        key: `h${i}`,
                        x: xs[i] - span / 2,
                        y: padTop,
                        width: span,
                        height: chartH,
                        fill: 'transparent',
                        style: { cursor: 'pointer' },
                        onMouseEnter: () => setHoveredIdx(i),
                        onMouseLeave: () => setHoveredIdx(null)
                    }))
                ]
                : React.createElement('g', null, areaD && React.createElement('path', { d: areaD, fill: 'url(#dup-grad-input)' }), pathD && React.createElement('path', { d: pathD, fill: 'none', stroke: '#007AFF', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })), 
            // Cost overlay on the right axis + its tick labels.
            costPathD && React.createElement('path', { d: costPathD, fill: 'none', stroke: '#F43F5E', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: '4 4' }), metric === 'tokens' &&
                [0, 0.5, 1].map((f, idx) => React.createElement('text', {
                    key: `cr${idx}`,
                    x: width - padRight + 8,
                    y: baseY - f * chartH + 3,
                    textAnchor: 'start',
                    fontSize: 8,
                    fill: '#F43F5E'
                }, formatCostCny(costMax * f))), 
            // X axis date labels
            xLabelIdx.map((idx) => React.createElement('text', {
                key: `x${idx}`,
                x: points[idx].x,
                y: height - 8,
                textAnchor: idx === 0 ? 'start' : idx === rows.length - 1 ? 'end' : 'middle',
                fontSize: 9,
                fill: '#86909C'
            }, shortDate(rows[idx].date))), 
            // Points for the non-composed metrics. A single bucket has no
            // line, so its dot is drawn larger — otherwise "today" would
            // render an empty plot.
            !composed &&
                points.map((p, idx) => React.createElement('circle', {
                    key: idx,
                    cx: p.x,
                    cy: p.y,
                    r: points.length === 1 ? 4 : hoveredIdx === idx ? 4.5 : 2.5,
                    fill: points.length === 1 || hoveredIdx === idx ? '#007AFF' : '#FFFFFF',
                    stroke: '#007AFF',
                    strokeWidth: 1.8,
                    style: { cursor: 'pointer', transition: 'r 120ms ease' },
                    onMouseEnter: () => setHoveredIdx(idx),
                    onMouseLeave: () => setHoveredIdx(null)
                })))), 
            // Legend for the composition series (and the hit-rate line).
            composed &&
                React.createElement('div', { className: 'dup-chart-legend' }, series.map((s) => React.createElement('span', { key: s.key, className: 'dup-legend-item' }, React.createElement('i', { style: { background: s.color } }), s.label)), React.createElement('span', { className: 'dup-legend-item' }, React.createElement('i', { style: { background: '#F43F5E', height: '2px', borderRadius: 0 } }), t('legendCostRight'))));
        }
        // ─── Surface A: Main Sidebar Dashboard Tab ──────────────────────────────────
        function UsageSidebarTab(props) {
            const { t } = props;
            const [range, setRange] = React.useState('today');
            const [summary, setSummary] = React.useState(null);
            const [timeseries, setTimeseries] = React.useState([]);
            const [modelBreakdown, setModelBreakdown] = React.useState([]);
            const [providerBreakdown, setProviderBreakdown] = React.useState([]);
            const [sessionBreakdown, setSessionBreakdown] = React.useState([]);
            const [details, setDetails] = React.useState(null);
            const [pricing, setPricing] = React.useState(null);
            const [ledger, setLedger] = React.useState(null);
            const [loading, setLoading] = React.useState(true);
            const [error, setError] = React.useState(null);
            const [refreshing, setRefreshing] = React.useState(false);
            const [refreshBanner, setRefreshBanner] = React.useState(null);
            // Detail table filter states
            const [filterModel, setFilterModel] = React.useState('');
            const [filterProvider, setFilterProvider] = React.useState('');
            const [filterSessionId, setFilterSessionId] = React.useState('');
            const [page, setPage] = React.useState(1);
            // Trend chart: which single model to plot ('' = every model).
            const [trendModel, setTrendModel] = React.useState('');
            // Request log: row key of the currently expanded per-call breakdown.
            const [expandedRow, setExpandedRow] = React.useState(null);
            // Custom date range: YYYY-MM-DD inputs applied as an explicit range.
            const [customOpen, setCustomOpen] = React.useState(false);
            const [customFrom, setCustomFrom] = React.useState('');
            const [customTo, setCustomTo] = React.useState('');
            const applyCustomRange = () => {
                if (!customFrom || !customTo)
                    return;
                const fromTs = Date.parse(customFrom + 'T00:00:00');
                const toTs = Date.parse(customTo + 'T23:59:59');
                if (Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs)
                    return;
                setRange({ from: new Date(fromTs).toISOString(), to: new Date(toTs).toISOString() });
                setPage(1);
            };
            // Price snapshot editor: which row is open and its working draft.
            const [editIdx, setEditIdx] = React.useState(null);
            const [draft, setDraft] = React.useState(null);
            const [priceBusy, setPriceBusy] = React.useState(false);
            const [priceMsg, setPriceMsg] = React.useState(null);
            const toNum = (v) => {
                const n = Number(v);
                return Number.isFinite(n) && n >= 0 ? n : 0;
            };
            // "GLM-5.3" vs "glm-5.3" read as the same name; only show the raw id
            // as a sub-line when it genuinely differs from the display label.
            const normId = (s) => s.toLowerCase().replace(/[-_.\s]+/g, '');
            const field = (label, key, type) => React.createElement('label', { className: 'dup-price-field' }, React.createElement('span', null, label), React.createElement('input', {
                type,
                className: 'dup-input',
                value: String(draft[key] ?? ''),
                onChange: (e) => setDraft((d) => ({ ...d, [key]: type === 'number' ? toNum(e.target.value) : e.target.value }))
            }));
            const startEdit = (idx, m) => {
                setEditIdx(idx);
                setDraft({
                    model: m.model,
                    provider: m.provider,
                    input: m.tiers?.input ?? 0,
                    output: m.tiers?.output ?? 0,
                    cacheRead: m.tiers?.cacheRead ?? 0,
                    cacheWrite: m.tiers?.cacheWrite ?? 0,
                    priceMode: m.priceMode,
                    sourceUrl: m.sourceUrl || '',
                    displayName: m.displayName
                });
            };
            const commitModels = async (models) => {
                setPriceBusy(true);
                try {
                    await callRpc('pricing-update', { models });
                    setEditIdx(null);
                    setDraft(null);
                    setPriceMsg(t('priceSaved'));
                    loadAllData(true);
                }
                catch (err) {
                    setPriceMsg(t('priceSaveErr', { message: err?.message || String(err) }));
                }
                finally {
                    setPriceBusy(false);
                }
            };
            const saveEdit = () => {
                if (editIdx === null || !draft || !pricing)
                    return;
                const next = pricing.models.map((m, i) => i === editIdx
                    ? {
                        model: draft.model,
                        provider: draft.provider,
                        tiers: { input: draft.input, output: draft.output, cacheRead: draft.cacheRead, cacheWrite: draft.cacheWrite },
                        priceMode: draft.priceMode,
                        sourceUrl: draft.sourceUrl,
                        displayName: draft.displayName
                    }
                    : m);
                void commitModels(next);
            };
            const addModel = () => {
                if (!pricing)
                    return;
                void commitModels([
                    ...pricing.models,
                    {
                        model: 'new-model',
                        provider: 'unknown',
                        tiers: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        priceMode: 'unpriced',
                        sourceUrl: '',
                        displayName: null
                    }
                ]);
            };
            const removeModel = (idx) => {
                if (!pricing || !window.confirm(t('priceConfirmDelete')))
                    return;
                void commitModels(pricing.models.filter((_drop, i) => i !== idx));
            };
            const trendModels = modelBreakdown.map((r) => r.key);
            const modelNames = {};
            for (const m of pricing?.models ?? []) {
                if (m.displayName)
                    modelNames[m.model] = m.displayName;
            }
            // Title follows the RANGE the user picked (今日/本周/本月/全部) —
            // that is the mental model; the bucket granularity is chart detail.
            const trendTitle = range === 'today'
                ? t('trendTitleToday')
                : range === 'week'
                    ? t('trendTitleWeek')
                    : range === 'month'
                        ? t('trendTitleMonth')
                        : range === 'all'
                            ? t('trendTitleAll')
                            : t('trendTitleCustom');
            // When this view mounts, the host's scroll container is still parked
            // wherever the chat was (usually the bottom), so the board opens
            // scrolled to its own bottom. Walk up to the first scrollable
            // ancestor and return it to the top.
            const rootRef = React.useRef(null);
            React.useEffect(() => {
                let node = rootRef.current;
                while (node && node !== document.body) {
                    if (node.scrollHeight > node.clientHeight + 1) {
                        node.scrollTop = 0;
                        break;
                    }
                    node = node.parentElement;
                }
            }, []);
            // Fetch all data for current range
            const loadAllData = React.useCallback((silent = false) => {
                if (!silent)
                    setLoading(true);
                setError(null);
                const filters = {};
                if (filterModel.trim())
                    filters.model = filterModel.trim();
                if (filterProvider.trim())
                    filters.provider = filterProvider.trim();
                if (filterSessionId.trim())
                    filters.sessionId = filterSessionId.trim();
                Promise.all([
                    callRpc('summary', { range }),
                    callRpc('timeseries', { range, bucket: 'auto', model: trendModel || undefined }),
                    callRpc('breakdown', { range, by: 'model' }),
                    callRpc('breakdown', { range, by: 'provider' }),
                    callRpc('breakdown', { range, by: 'session' }),
                    callRpc('detail', { range, filters, page, pageSize: 20 }),
                    callRpc('pricing', {}),
                    callRpc('ledger', {})
                ])
                    .then(([s, ts, mb, pb, sb, dt, pr, lg]) => {
                    setSummary(s);
                    setTimeseries(ts);
                    setModelBreakdown(mb);
                    setProviderBreakdown(pb);
                    setSessionBreakdown(sb);
                    setDetails(dt);
                    setPricing(pr);
                    setLedger(lg);
                    setLoading(false);
                })
                    .catch((err) => {
                    setError(err?.message || String(err));
                    setLoading(false);
                });
            }, [range, filterModel, filterProvider, filterSessionId, page, trendModel]);
            // Immediate fetch on change
            React.useEffect(() => {
                loadAllData();
            }, [loadAllData]);
            // 60s polling for today's metrics
            React.useEffect(() => {
                if (range !== 'today')
                    return;
                const timer = setInterval(() => {
                    loadAllData(true);
                }, 60000);
                return () => clearInterval(timer);
            }, [range, loadAllData]);
            // Manual refresh handler
            const handleManualRefresh = () => {
                setRefreshing(true);
                setRefreshBanner(null);
                callRpc('refresh', { prices: true })
                    .then((res) => {
                    setRefreshing(false);
                    setRefreshBanner(t('refreshSuccess', { files: res.rescannedFiles, calls: res.newCalls }));
                    loadAllData(true);
                })
                    .catch((err) => {
                    setRefreshing(false);
                    setError(err?.message || String(err));
                });
            };
            return React.createElement('div', { className: 'dup-root', ref: rootRef }, 
            // 1. Top Controls Bar: Time Filter
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } }, React.createElement('div', { className: 'dup-segmented' }, React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (range === 'today' ? ' is-active' : ''),
                onClick: () => {
                    setRange('today');
                    setPage(1);
                }
            }, t('rangeToday')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (range === 'week' ? ' is-active' : ''),
                onClick: () => {
                    setRange('week');
                    setPage(1);
                }
            }, t('rangeWeek')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (range === 'month' ? ' is-active' : ''),
                onClick: () => {
                    setRange('month');
                    setPage(1);
                }
            }, t('rangeMonth')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (range === 'all' ? ' is-active' : ''),
                onClick: () => {
                    setRange('all');
                    setPage(1);
                }
            }, t('rangeAll')), React.createElement('button', {
                type: 'button',
                className: 'dup-segment-btn' + (typeof range === 'object' ? ' is-active' : ''),
                onClick: () => setCustomOpen((open) => !open)
            }, t('rangeCustom'))), React.createElement('button', {
                type: 'button',
                className: 'dup-btn',
                onClick: handleManualRefresh,
                disabled: refreshing,
                title: t('btnRefresh')
            }, React.createElement(IconRefresh, { spinning: refreshing }), refreshing ? t('btnRefreshing') : t('btnRefresh'))), customOpen &&
                React.createElement('div', { className: 'dup-custom-row' }, React.createElement('input', {
                    type: 'date',
                    className: 'dup-input',
                    value: customFrom,
                    'aria-label': t('customFrom'),
                    onChange: (e) => setCustomFrom(e.target.value)
                }), React.createElement('span', { style: { color: 'var(--dup-ink-3, #86909C)' } }, '→'), React.createElement('input', {
                    type: 'date',
                    className: 'dup-input',
                    value: customTo,
                    'aria-label': t('customTo'),
                    onChange: (e) => setCustomTo(e.target.value)
                }), React.createElement('button', { type: 'button', className: 'dup-btn', onClick: applyCustomRange }, t('customApply'))), 
            // Loading indicator
            loading &&
                React.createElement('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 0',
                        color: 'var(--dsw-text-tertiary, #86909C)',
                        fontSize: '12px',
                        gap: '6px'
                    }
                }, React.createElement(IconRefresh, { spinning: true }), React.createElement('span', null, t('loading'))), 
            // Error banner if any
            error &&
                React.createElement('div', { className: 'dup-error-banner' }, React.createElement('span', null, t('errFailed', { msg: error })), React.createElement('button', { type: 'button', className: 'dup-btn', onClick: () => loadAllData() }, t('btnRetry'))), 
            // Refresh banner feedback
            refreshBanner &&
                React.createElement('div', {
                    style: {
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px solid rgba(52, 199, 89, 0.25)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#28A745',
                        fontSize: '12px'
                    }
                }, refreshBanner), 
            // 2. KPI Summary Cards Grid
            summary &&
                React.createElement('div', { className: 'dup-kpi-grid' }, 
                // Total Tokens
                React.createElement('div', { className: 'dup-card dup-kpi-card' }, React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalTokens')), React.createElement('span', { className: 'dup-kpi-val' }, formatTokens(summary.tokens.total)), React.createElement('span', { className: 'dup-kpi-sub' }, `In: ${formatTokens(summary.tokens.input)} · Out: ${formatTokens(summary.tokens.output)}`)), 
                // Fresh (uncached) input — cc-switch's "real consumption" framing:
                // the part that was NOT served from cache, i.e. what the
                // hit-rate card does NOT cover.
                React.createElement('div', { className: 'dup-card dup-kpi-card' }, React.createElement('span', { className: 'dup-kpi-label' }, t('kpiRealInput')), React.createElement('span', { className: 'dup-kpi-val' }, formatTokens(summary.tokens.input)), React.createElement('span', { className: 'dup-kpi-sub' }, t('kpiRealInputSub'))), 
                // Total Cost
                React.createElement('div', { className: 'dup-card dup-kpi-card' }, React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalCost')), React.createElement('span', { className: 'dup-kpi-val' }, formatCostCny(summary.cost.total)), React.createElement('span', { className: 'dup-kpi-sub' }, `按 1 USD = ${USD_TO_CNY} CNY 换算`)), 
                // Cache Hit Rate
                React.createElement('div', { className: 'dup-card dup-kpi-card' }, React.createElement('span', { className: 'dup-kpi-label' }, t('kpiCacheHitRate')), React.createElement('span', { className: 'dup-kpi-val', style: { color: summary.cacheHitRate > 0.5 ? '#34C759' : undefined } }, formatPercent(summary.cacheHitRate)), React.createElement('span', { className: 'dup-kpi-sub' }, React.createElement('span', { className: 'dup-kpi-pill' }, 'Hit ' + formatTokens(summary.tokens.cacheRead)))), 
                // Total Calls & Sessions
                React.createElement('div', { className: 'dup-card dup-kpi-card' }, React.createElement('span', { className: 'dup-kpi-label' }, t('kpiTotalCalls')), React.createElement('span', { className: 'dup-kpi-val' }, formatNumber(summary.calls)), React.createElement('span', { className: 'dup-kpi-sub' }, `${t('kpiSessions')}: ${formatNumber(summary.sessions)}`))), 
            // 3. Main vs Subagent Split Card
            summary &&
                summary.mainSub &&
                React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('agentSplitTitle'))), React.createElement('div', { className: 'dup-split-bar' }, React.createElement('div', {
                    className: 'dup-split-main',
                    style: {
                        width: summary.tokens.total > 0 ? (summary.mainSub.main.tokens / summary.tokens.total) * 100 + '%' : '50%'
                    }
                }), React.createElement('div', {
                    className: 'dup-split-sub',
                    style: {
                        width: summary.tokens.total > 0 ? (summary.mainSub.subagent.tokens / summary.tokens.total) * 100 + '%' : '50%'
                    }
                })), React.createElement('div', { className: 'dup-split-legend' }, React.createElement('span', null, React.createElement('span', { style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#007AFF', marginRight: 4 } }), `${t('mainAgent')}: ${formatTokens(summary.mainSub.main.tokens)} (${formatCostCny(summary.mainSub.main.cost)})`), React.createElement('span', null, React.createElement('span', { style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#AF52DE', marginRight: 4 } }), `${t('subAgent')}: ${formatTokens(summary.mainSub.subagent.tokens)} (${formatCostCny(summary.mainSub.subagent.cost)})`))), 
            // 4. Daily Timeseries Trend Chart
            React.createElement(TimeseriesChart, {
                rows: timeseries,
                t,
                title: trendTitle,
                models: trendModels,
                trendModel,
                onModelChange: setTrendModel,
                modelNames
            }), 
            // 5. Model + Provider tables pair side-by-side on wide screens.
            React.createElement('div', { className: 'dup-cols' }, React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('breakdownTitle'))), modelBreakdown.length === 0
                ? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colModel')), React.createElement('th', null, t('colTokens')), React.createElement('th', null, t('colCost')), React.createElement('th', null, t('colCalls')), React.createElement('th', null, t('colCacheHit')))), React.createElement('tbody', null, modelBreakdown.map((row) => {
                    // Prefer the catalog's curated entry for this model id. The
                    // breakdown key is the raw id; displayName is what the user
                    // should read.
                    const pricingEntry = pricing?.models?.find((m) => m.model === row.key);
                    const mode = pricingEntry ? pricingEntry.priceMode : row.cost === 0 && row.tokens > 0 ? 'unpriced' : 'official';
                    const label = pricingEntry?.displayName || row.key;
                    const showId = normId(label) !== normId(row.key);
                    return React.createElement('tr', { key: row.key }, React.createElement('td', { style: { fontWeight: 600 } }, React.createElement('div', null, label), showId &&
                        React.createElement('div', { style: { fontSize: '10px', color: 'var(--dsw-text-tertiary, #86909C)', fontFamily: 'monospace' } }, row.key), React.createElement('div', { style: { marginTop: 3 } }, React.createElement(PriceModeBadge, { mode, t }))), React.createElement('td', null, formatTokens(row.tokens)), React.createElement('td', null, mode === 'unpriced'
                        ? React.createElement('span', { className: 'dup-badge dup-badge-unpriced' }, t('badgeUnpriced'))
                        : formatCostCny(row.cost)), React.createElement('td', null, formatNumber(row.calls)), React.createElement('td', null, formatPercent(row.cacheHitRate)));
                }))))), 
            // 6. Session Top List (with subagent rollup)
            React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('sessionTopTitle'))), sessionBreakdown.length === 0
                ? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colSessionId')), React.createElement('th', null, t('colTokens')), React.createElement('th', null, t('colCost')), React.createElement('th', null, t('colCalls')))), React.createElement('tbody', null, sessionBreakdown.slice(0, 8).map((row) => React.createElement('tr', { key: row.key }, React.createElement('td', null, React.createElement('div', { style: { fontFamily: 'monospace', fontWeight: 600 } }, row.sessionMeta?.title || formatShortSession(row.key)), row.sub && row.sub > 0
                    ? React.createElement('div', { style: { fontSize: '11px', color: '#AF52DE', marginTop: 2 } }, t('sessionSubRollup', { sub: formatTokens(row.sub) }))
                    : null), React.createElement('td', null, formatTokens(row.tokens)), React.createElement('td', null, formatCostCny(row.cost)), React.createElement('td', null, formatNumber(row.calls))))))))), 
            // Second pair row: provider + price editor share the grid below.
            React.createElement('div', { className: 'dup-cols' }, 
            // 6b. Provider Breakdown (cc-switch's ProviderStatsTable)
            React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('providerTitle'))), providerBreakdown.length === 0
                ? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colProvider')), React.createElement('th', null, t('colTokens')), React.createElement('th', null, t('colCost')), React.createElement('th', null, t('colCalls')), React.createElement('th', null, t('colCacheHit')))), React.createElement('tbody', null, providerBreakdown.map((row) => React.createElement('tr', { key: row.key }, React.createElement('td', { style: { fontWeight: 600 } }, row.key), React.createElement('td', null, formatTokens(row.tokens)), React.createElement('td', null, formatCostCny(row.cost)), React.createElement('td', null, formatNumber(row.calls)), React.createElement('td', null, formatPercent(row.cacheHitRate)))))))), 
            // 6c. Price snapshot editor: per-row edit, validated atomic rewrite,
            // engine hot-reload — the board reflects new prices immediately.
            React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('priceTitle')), React.createElement('span', { className: 'dup-kpi-sub' }, t('priceUnit'))), priceMsg && React.createElement('div', { className: 'dup-empty-desc' }, priceMsg), !pricing
                ? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colModel')), React.createElement('th', null, t('colProvider')), React.createElement('th', null, t('legendUncachedInput')), React.createElement('th', null, t('legendOutput')), React.createElement('th', null, t('legendCacheRead')), React.createElement('th', null, t('legendCacheWrite')), React.createElement('th', null, t('priceModeLabel')), React.createElement('th', null, t('priceActions')))), React.createElement('tbody', null, pricing.models.map((m, i) => editIdx === i && draft
                    ? React.createElement('tr', { key: 'edit-' + i }, React.createElement('td', { colSpan: 8 }, React.createElement('div', { className: 'dup-price-form' }, field(t('colModel'), 'model', 'text'), field(t('colProvider'), 'provider', 'text'), field(t('legendUncachedInput'), 'input', 'number'), field(t('legendOutput'), 'output', 'number'), field(t('legendCacheRead'), 'cacheRead', 'number'), field(t('legendCacheWrite'), 'cacheWrite', 'number'), React.createElement('label', { className: 'dup-price-field' }, React.createElement('span', null, t('priceModeLabel')), React.createElement('select', {
                        className: 'dup-input',
                        value: draft.priceMode,
                        onChange: (e) => setDraft((d) => ({ ...d, priceMode: e.target.value }))
                    }, ['official', 'unpriced', 'official-alias', 'cross-verified', 'single-source', 'community', 'shadow'].map((mode) => React.createElement('option', { key: mode, value: mode }, mode)))), React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-end' } }, React.createElement('button', { type: 'button', className: 'dup-btn', disabled: priceBusy, onClick: saveEdit }, t('priceSave')), React.createElement('button', {
                        type: 'button',
                        className: 'dup-btn',
                        onClick: () => {
                            setEditIdx(null);
                            setDraft(null);
                        }
                    }, t('priceCancel'))))))
                    : React.createElement('tr', { key: m.model }, React.createElement('td', null, React.createElement('div', { style: { fontWeight: 600 } }, m.displayName || m.model), m.displayName && normId(m.displayName) !== normId(m.model)
                        ? React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-text-tertiary, #86909C)', fontFamily: 'monospace' } }, m.model)
                        : null), React.createElement('td', null, m.provider), React.createElement('td', null, String(m.tiers?.input ?? 0)), React.createElement('td', null, String(m.tiers?.output ?? 0)), React.createElement('td', null, String(m.tiers?.cacheRead ?? 0)), React.createElement('td', null, String(m.tiers?.cacheWrite ?? 0)), React.createElement('td', null, m.priceMode), React.createElement('td', null, React.createElement('button', { type: 'button', className: 'dup-btn', onClick: () => startEdit(i, m) }, t('priceEdit')), React.createElement('button', {
                        type: 'button',
                        className: 'dup-btn',
                        style: { marginLeft: '4px' },
                        disabled: priceBusy,
                        onClick: () => removeModel(i)
                    }, t('priceDelete')))))))), React.createElement('div', { style: { marginTop: '8px' } }, React.createElement('button', { type: 'button', className: 'dup-btn', disabled: priceBusy, onClick: addModel }, t('priceAdd'))))), 
            // 7. Call-level Audit Detail Table (Paginated + Filtered)
            React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, t('detailsTitle'))), 
            // Filters
            React.createElement('div', { className: 'dup-filter-row' }, React.createElement('input', {
                type: 'text',
                className: 'dup-input',
                placeholder: t('filterModelPlaceholder'),
                value: filterModel,
                onChange: (e) => {
                    setFilterModel(e.target.value);
                    setPage(1);
                }
            }), React.createElement('input', {
                type: 'text',
                className: 'dup-input',
                placeholder: t('filterProviderPlaceholder'),
                value: filterProvider,
                onChange: (e) => {
                    setFilterProvider(e.target.value);
                    setPage(1);
                }
            }), React.createElement('input', {
                type: 'text',
                className: 'dup-input',
                placeholder: t('filterSessionPlaceholder'),
                value: filterSessionId,
                onChange: (e) => {
                    setFilterSessionId(e.target.value);
                    setPage(1);
                }
            })), 
            // Detail rows
            !details || details.rows.length === 0
                ? React.createElement('div', { className: 'dup-empty-desc', style: { padding: '16px 0', textAlign: 'center' } }, t('emptyList'))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colTimestamp')), React.createElement('th', null, t('colModel')), React.createElement('th', null, t('colOrigin')), React.createElement('th', null, t('colUsageDetail')), React.createElement('th', null, t('colCost')))), React.createElement('tbody', null, details.rows.map((r, idx) => {
                    const detailLabel = pricing?.models?.find((m) => m.model === r.model)?.displayName || r.model || '—';
                    const rowKey = r.ts + '-' + idx;
                    const expanded = expandedRow === rowKey;
                    const item = (label, value) => React.createElement('div', { className: 'dup-detail-item' }, React.createElement('span', null, label), React.createElement('b', null, value));
                    return [
                        React.createElement('tr', {
                            key: rowKey,
                            style: { cursor: 'pointer' },
                            title: t('detailExpandHint'),
                            onClick: () => setExpandedRow((cur) => (cur === rowKey ? null : rowKey))
                        }, React.createElement('td', { style: { whiteSpace: 'nowrap' } }, formatTimestamp(r.ts)), React.createElement('td', null, React.createElement('div', { style: { fontWeight: 600 } }, detailLabel), React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-text-tertiary, #86909C)' } }, r.provider || '')), React.createElement('td', null, React.createElement('span', {
                            className: 'dup-badge',
                            style: {
                                background: r.origin === 'subagent' ? 'rgba(175,82,222,0.1)' : 'rgba(0,122,255,0.1)',
                                color: r.origin === 'subagent' ? '#AF52DE' : '#007AFF'
                            }
                        }, r.origin === 'subagent' ? t('originSubagent') : t('originMain'))), React.createElement('td', null, React.createElement('div', null, `${formatTokens(r.usage.input)} / ${formatTokens(r.usage.output)}`), r.usage.cacheRead > 0 &&
                            React.createElement('div', { style: { fontSize: '10px', color: '#34C759' } }, `Hit: ${formatTokens(r.usage.cacheRead)}`)), React.createElement('td', null, r.priceMode === 'unpriced' || r.cost === null
                            ? React.createElement('span', { className: 'dup-badge dup-badge-unpriced' }, t('badgeUnpriced'))
                            : React.createElement('div', null, React.createElement('div', null, formatCostCny(r.cost)), r.priceMode === 'shadow' && React.createElement(PriceModeBadge, { mode: 'shadow', t })))),
                        expanded
                            ? React.createElement('tr', { key: rowKey + '-x' }, React.createElement('td', { colSpan: 5, style: { background: 'var(--dsw-bg-secondary, #F2F3F5)', padding: '8px 10px' } }, React.createElement('div', { className: 'dup-detail-grid' }, item(t('legendUncachedInput'), formatTokens(r.usage.input)), item(t('legendCacheRead'), formatTokens(r.usage.cacheRead)), item(t('legendCacheWrite'), formatTokens(r.usage.cacheWrite)), item(t('legendOutput'), formatTokens(r.usage.output)), item(t('kpiTotalTokens'), formatTokens(r.usage.total)), item(t('colProvider'), r.provider || '—'), item(t('colCost'), r.cost === null ? t('badgeUnpriced') : formatCostCny(r.cost)))))
                            : null
                    ];
                }))), 
                // Pagination footer
                React.createElement('div', { className: 'dup-pagination' }, React.createElement('button', {
                    type: 'button',
                    className: 'dup-btn',
                    disabled: page <= 1,
                    onClick: () => setPage((p) => Math.max(1, p - 1))
                }, t('pagePrev')), React.createElement('span', { style: { fontSize: '12px', color: 'var(--dsw-text-tertiary, #86909C)' } }, t('pageIndicator', { page, total: details.total })), React.createElement('button', {
                    type: 'button',
                    className: 'dup-btn',
                    disabled: page * details.pageSize >= details.total,
                    onClick: () => setPage((p) => p + 1)
                }, t('pageNext'))))), 
            // 8. Web-Router Ledger Area
            React.createElement('div', { className: 'dup-card' }, React.createElement('div', { className: 'dup-card-header' }, React.createElement('span', { className: 'dup-card-title' }, React.createElement(IconRouter), t('ledgerTitle')), ledger && ledger.available && React.createElement('span', { className: 'dup-kpi-pill' }, `${t('ledgerDerivedCny')}: ¥${ledger.derivedCny.toFixed(2)}`)), !ledger || !ledger.available
                ? React.createElement('div', { className: 'dup-empty-card' }, React.createElement('div', { className: 'dup-empty-title' }, t('ledgerEmptyTitle')), React.createElement('div', { className: 'dup-empty-desc' }, t('ledgerEmptyDesc')))
                : React.createElement('div', { className: 'dup-table-wrap' }, React.createElement('table', { className: 'dup-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, t('colChannel')), React.createElement('th', null, t('colCostType')), React.createElement('th', null, t('colCount')), React.createElement('th', null, t('colLastTs')))), React.createElement('tbody', null, ledger.byChannel.map((ch, idx) => React.createElement('tr', { key: ch.channel + '-' + ch.costType + '-' + idx }, React.createElement('td', { style: { fontWeight: 600 } }, ch.channel), React.createElement('td', null, React.createElement('span', {
                    className: 'dup-badge ' + (ch.costType === 'free' ? 'dup-badge-free' : ch.costType === 'quota' ? 'dup-badge-quota' : 'dup-badge-paid')
                }, ch.costType === 'free' ? t('costFree') : ch.costType === 'quota' ? t('costQuota') : t('costPaid'))), React.createElement('td', null, formatNumber(ch.counts)), React.createElement('td', null, formatTimestamp(ch.lastTs)))))))), 
            // 9. Pricing Footnote & Metadata
            pricing &&
                React.createElement('div', { className: 'dup-footer' }, React.createElement('span', null, t('pricingSource', { src: pricing.source }), pricing.fetchedAt ? ' · ' + t('pricingFetchedAt', { time: formatTimestamp(pricing.fetchedAt) }) : ''), React.createElement('span', { style: { fontStyle: 'italic', opacity: 0.8 } }, t('unpricedWarning'))));
        }
        // ─── Surface B: Composer Bottom Status Bar ──────────────────────────────────
        function ComposerStatusBar(props) {
            const { t } = props;
            const [summary, setSummary] = React.useState(null);
            const [error, setError] = React.useState(null);
            const fetchSummary = React.useCallback(() => {
                callRpc('summary', { range: 'today' })
                    .then((value) => {
                    setSummary(value);
                    setError(null);
                })
                    .catch((err) => {
                    // Fail loud in the surface, never render a fake zero: the chip
                    // shows — and the tooltip carries the reason.
                    const message = String(err?.message ?? err);
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
            return React.createElement('div', {
                className: 'dup-composer-chip',
                title: error !== null ? t('loadError', { message: error }) : t('title')
            }, React.createElement(IconBolt), React.createElement('span', null, t('composerBarToday', { tokens: tokensStr, cost: costStr })));
        }
        // ─── Cordis Client Lifecycle Entry ─────────────────────────────────────────
        const inject = ['slots', 'timer', 'locale'];
        function apply(ctx) {
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
            // 3. Register Surface A: Main-area View Tab (full-width dashboard).
            // The host builds the main-area tab strip from conversation.view slot
            // entries ({ id, label }) and renders the selected entry into the
            // whole view area below the session header.
            ctx.slots.inject('conversation.view', () => ctx.slots.register({
                name: 'conversation.view',
                id: 'usage-dashboard',
                label: () => t('title'),
                locale: NS
            }, (props) => React.createElement(UsageSidebarTab, { ...props, t })));
            // 4. Register Surface B: Composer Bottom Status Bar
            ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
                name: 'conversation.composer.dock',
                id: 'usage-composer-dock',
                order: 15,
                locale: NS
            }, () => React.createElement(ComposerStatusBar, { t, ctx })));
        }
        exports.apply = apply;
        exports.inject = inject;
        return module.exports;
    }
});
