/**
 * dsh-quota-panel — client half (browser bundle, served at
 * /plugins/dsh-quota-panel/client.js through the `dsh.client` manifest).
 *
 * Registers one `shell.overlay` slot entry rendering the quota widget with
 * React: a collapsed glanceable capsule by default
 * (header "模型额度" + health dot + 用量池/余额池 sections), expanding on
 * click into the full card (header "模型额度" + per-provider cards +
 * progress bars). The gear button opens the settings panel:
 * per-provider visibility, refresh interval, and per-provider warn
 * thresholds — persisted to localStorage, never sent anywhere.
 *
 * Data arrives over the loopback Connection RPC channel `/dsh-quota-panel`
 * (endpoints `specs` / `fetch-all`) owned by the host half in lib/index.js;
 * API keys never reach the browser. `fetch-all` rows carry host-normalized
 * views (kind balance / usage / info) — upstream JSON schemas stay
 * host-side; threshold judgement and coloring happen here from spec hints
 * so the local settings overrides apply without a refetch.
 *
 * Styled after the Arco Design (ByteDance) three-board mock
 * (`prompts/capsule-arco-mock.html`): white solid cards, 8px card radius,
 * 1px #E5E6EB borders, 6px progress tracks, provider pool dots. Tokens are
 * consumed as `var(--dsw-*, Arco value)` so the harness theme can override;
 * the settings view renders inside `#dsh-quota-card.is-settings`.
 */
window.__ModuleLoader__.load({
    id: "dsh-quota-panel",
    factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
        var React = require("react");
        // Connection's authenticated /api channel; the host half mounts one exact
        // Fetch route per endpoint under the dsh-quota-panel method namespace.
        var CHANNEL = "/api";
        var RPC_METHOD_PREFIX = "dsh-quota-panel";
        var STORAGE_KEY = "dsh-quota-panel:settings";
        var REFRESH_CHOICES = [
            { value: "" },
            { value: "15000" },
            { value: "30000" },
            { value: "60000" },
            { value: "120000" },
            { value: "300000" }
        ];
        /** i18n: namespace registered into the shell locale service (apply). */
        var NS = "quota-panel";
        var DICT = {
            zh: {
                title: "模型额度",
                settingsTitle: "设置",
                poolUsage: "用量池",
                poolBalance: "余额池",
                healthCount: "{n} 家",
                expand: "展开模型额度",
                collapse: "收起模型额度",
                refresh: "刷新模型额度",
                openSettings: "打开设置",
                closeSettings: "关闭设置",
                allHidden: "已全部隐藏",
                emptyHint: "所有供应商均已隐藏，可在设置中开启",
                updatedAt: "更新于 {time}",
                connectedBadge: "{n} 家已连通",
                footerRefresh: "自动刷新 {n} 秒",
                footerSettings: "偏好设置",
                loadFailed: "无法读取配置",
                fetchFailed: "查询失败",
                usageUnavailable: "暂时无法获取用量",
                quotaUnavailable: "暂时无法获取配额",
                balanceUnavailable: "暂时无法获取余额",
                balanceAbnormal: "余额数据异常",
                winRolling: "滚", winWeekly: "周", winMonthly: "月", winSearch: "搜索",
                settingsCapsule: "胶囊显示",
                capsuleName: "收起态数值",
                capsuleAuto: "自动（最高）",
                capsuleRolling: "5h 窗口",
                capsuleWeekly: "周窗口",
                capsuleMax: "最高窗口",
                noWinData: "无数据",
                peakUsage: "当前已使用 {pct}%",
                peakUsageWaiting: "当前已使用 {pct}% 等待重置 {time}",
                nextReset: "下次重置 {time}",
                balanceCritical: "建议充值",
                balanceWarn: "余额紧张",
                rateLimited: "频控中",
                rateLimitedReset: "频控中 · {time} 重置",
                rateLimitedWithModel: "频控中 · {model}",
                rateLimitedResetWithModel: "频控中 · {model} · {time} 重置",
                peakBadge: "高峰",
                offPeak50: "空闲·5折",
                offPeakHalf: "空闲·半价",
                holidaysTitle: "DeepSeek 节假日表",
                holidaysHint: "逗号分隔 YYYY-MM-DD（如 2026-10-01,2026-10-02）。DeepSeek 高峰=工作日 9-12/14-18（周末与此表除外）；GLM 高峰=工作日 14-18，不看此表。表为空时只按周末判断——法定节假日请自行录入。",
                balanceOk: "余额正常",
                balanceRich: "余额充足",
                settingsProviders: "显示供应商",
                settingsNoProviders: "（未配置供应商）",
                settingsInterval: "刷新与显示",
                settingsAutoRefresh: "自动刷新",
                settingsAdvanced: "高级设置",
                capsuleAutoShort: "自动",
                capsuleRollingShort: "5h",
                capsuleWeeklyShort: "周",
                capsuleMaxShort: "最高",
                panelPosition: "面板位置",
                resetPosition: "重置居右下",
                defaultPosition: "默认右下角",
                badgeUsage: "用量",
                badgeBalance: "余额",
                badgeInfo: "信息",
                followConfig: "跟随配置",
                secondsSuffix: "{n} 秒",
                minutesSuffix: "{n} 分钟",
                settingsProxy: "代理",
                proxyHint: "填写 http(s) 代理 URL，仅该供应商经此代理查询",
                proxyConfigured: "已配置代理：{name}（留空沿用）",
                proxyDirect: "http://127.0.0.1:7890（留空直连）",
                settingsThresholds: "预警阈值",
                warnPercentPH: "预警 %（默认 {n}）",
                warnBalancePH: "预警 {cur}（默认 {n}）",
                localOnly: "设置仅保存在本浏览器",
                resetDefaults: "恢复默认",
                chatgptAccount: "ChatGPT 账号",
                chatgptLogin: "登录 ChatGPT",
                chatgptLogout: "退出登录",
                chatgptLoggedIn: "已登录（{source}）",
                chatgptSourceDsh: "插件内登录",
                chatgptSourceCodex: "Codex CLI",
                chatgptPlan: "套餐：{plan}",
                chatgptLoginHint: "未登录。点下方按钮，在浏览器用 ChatGPT 账号授权即可，无需安装 Codex CLI。",
                chatgptLoginStep1: "1. 打开此链接并登录：",
                chatgptLoginStep2: "2. 输入一次性验证码（15 分钟内有效）：",
                chatgptWaiting: "等待浏览器授权中…",
                chatgptLoginFailed: "登录失败：{msg}",
                chatgptCopy: "复制",
                chatgptCopied: "已复制",
                chatgptOpenLink: "打开链接",
                chatgptCancel: "取消",
                chatgptProxy: "ChatGPT 代理（可选）",
                chatgptProxyHint: "登录与用量查询均经此 http(s) 代理（地区受限网络需要）；留空直连",
                chatgptProxyDirect: "http://127.0.0.1:7890（留空直连）"
            },
            en: {
                title: "Model quota",
                settingsTitle: "Settings",
                poolUsage: "Usage pools",
                poolBalance: "Balance pools",
                healthCount: "{n} providers",
                expand: "Expand model quota",
                collapse: "Collapse model quota",
                refresh: "Refresh model quota",
                openSettings: "Open settings",
                closeSettings: "Close settings",
                allHidden: "all hidden",
                emptyHint: "All providers are hidden — re-enable them in settings",
                updatedAt: "Updated {time}",
                connectedBadge: "{n} connected",
                footerRefresh: "auto refresh {n}s",
                footerSettings: "Preferences",
                loadFailed: "Failed to load config",
                fetchFailed: "Query failed",
                usageUnavailable: "Usage unavailable",
                quotaUnavailable: "Quota unavailable",
                balanceUnavailable: "Balance unavailable",
                balanceAbnormal: "Malformed balance data",
                winRolling: "Roll", winWeekly: "Wk", winMonthly: "Mo", winSearch: "Search",
                settingsCapsule: "Capsule display",
                capsuleName: "Collapsed value",
                capsuleAuto: "Auto (highest)",
                capsuleRolling: "5h window",
                capsuleWeekly: "Weekly window",
                capsuleMax: "Highest window",
                noWinData: "no data",
                peakUsage: "Used {pct}%",
                peakUsageWaiting: "Used {pct}% — awaiting reset {time}",
                nextReset: "Next reset {time}",
                balanceCritical: "Top-up suggested",
                balanceWarn: "Running low",
                rateLimited: "Rate limited",
                rateLimitedReset: "Rate limited · resets {time}",
                rateLimitedWithModel: "Rate limited · {model}",
                rateLimitedResetWithModel: "Rate limited · {model} · resets {time}",
                peakBadge: "Peak",
                offPeak50: "Off·50%",
                offPeakHalf: "Off·half",
                holidaysTitle: "DeepSeek holidays",
                holidaysHint: "Comma-separated YYYY-MM-DD (e.g. 2026-10-01,2026-10-02). DeepSeek peak = weekdays 9-12/14-18 minus weekends and this list; GLM peak = weekdays 14-18 regardless. Empty = weekends only — add statutory holidays yourself.",
                balanceOk: "Healthy",
                balanceRich: "Plenty",
                settingsProviders: "Providers",
                settingsNoProviders: "(no providers configured)",
                settingsInterval: "Refresh & Display",
                settingsAutoRefresh: "Auto refresh",
                settingsAdvanced: "Advanced",
                capsuleAutoShort: "Auto",
                capsuleRollingShort: "5h",
                capsuleWeeklyShort: "Week",
                capsuleMaxShort: "Max",
                panelPosition: "Panel position",
                resetPosition: "Reset to corner",
                defaultPosition: "Default corner",
                badgeUsage: "Usage",
                badgeBalance: "Balance",
                badgeInfo: "Info",
                followConfig: "Follow config",
                secondsSuffix: "{n}s",
                minutesSuffix: "{n} min",
                settingsProxy: "Proxy",
                proxyHint: "http(s) proxy URL — only this provider is queried through it",
                proxyConfigured: "Configured proxy: {name} (empty keeps it)",
                proxyDirect: "http://127.0.0.1:7890 (empty = direct)",
                settingsThresholds: "Warn thresholds",
                warnPercentPH: "Warn % (default {n})",
                warnBalancePH: "Warn {cur} (default {n})",
                localOnly: "Stored in this browser only",
                resetDefaults: "Reset defaults",
                chatgptAccount: "ChatGPT account",
                chatgptLogin: "Log in to ChatGPT",
                chatgptLogout: "Log out",
                chatgptLoggedIn: "Signed in ({source})",
                chatgptSourceDsh: "in-plugin login",
                chatgptSourceCodex: "Codex CLI",
                chatgptPlan: "Plan: {plan}",
                chatgptLoginHint: "Not signed in. Click below and authorize with your ChatGPT account in the browser — no Codex CLI install required.",
                chatgptLoginStep1: "1. Open this link and sign in:",
                chatgptLoginStep2: "2. Enter this one-time code (valid for 15 minutes):",
                chatgptWaiting: "Waiting for browser authorization…",
                chatgptLoginFailed: "Login failed: {msg}",
                chatgptCopy: "Copy",
                chatgptCopied: "Copied",
                chatgptOpenLink: "Open link",
                chatgptCancel: "Cancel",
                chatgptProxy: "ChatGPT proxy (optional)",
                chatgptProxyHint: "Login and usage queries go through this http(s) proxy (needed on region-restricted networks); empty = direct",
                chatgptProxyDirect: "http://127.0.0.1:7890 (empty = direct)"
            }
        };
        // Overlay lift (issue #1): shell.overlay renders inside AppFrame's
        // overlayLayer (z-index:20), so any body-mounted third-party fixed
        // panel (z-index:1000+, common with sidebar plugins) covers the whole
        // overlay layer. Lifting the layer itself keeps the widget inside the
        // React tree (event delegation intact) instead of re-mounting it.
        var OVERLAY_LIFT_CSS = '[class*="overlayLayer"]{z-index:1150 !important;}';
        // Arco Design v2 tokens (mock: prompts/capsule-arco-mock.html). Every
        // colour is consumed as var(--dsw-*, Arco value) so the harness theme
        // can override; scopes stay under #dsh-quota-capsule / #dsh-quota-card
        // (the settings view renders inside #dsh-quota-card.is-settings).
        var CSS = [
            '#dsh-quota-panel{position:fixed;right:18px;bottom:18px;z-index:900;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto;color:var(--dsw-text-title,#1D2129);font-family:var(--dsw-font-family,Inter,-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",Roboto,sans-serif);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
            '#dsh-quota-capsule .dsh-capsule-pool-dot,#dsh-quota-card .dsh-pool-dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}',
            '#dsh-quota-capsule .dot-chatgpt,#dsh-quota-card .dot-chatgpt{background:var(--dsw-dot-chatgpt,#14C9C9)}',
            '#dsh-quota-capsule .dot-zhipu,#dsh-quota-card .dot-zhipu{background:var(--dsw-dot-zhipu,#165DFF)}',
            '#dsh-quota-capsule .dot-aggemini,#dsh-quota-card .dot-aggemini{background:var(--dsw-dot-aggemini,#722ED1)}',
            '#dsh-quota-capsule .dot-agclaude,#dsh-quota-card .dot-agclaude{background:var(--dsw-dot-agclaude,#FF7D00)}',
            '#dsh-quota-capsule .dot-workbuddy,#dsh-quota-card .dot-workbuddy{background:var(--dsw-dot-workbuddy,#00B42A)}',
            '#dsh-quota-capsule .dot-deepseek,#dsh-quota-card .dot-deepseek{background:var(--dsw-dot-deepseek,#165DFF)}',
            '#dsh-quota-capsule .dot-qoder,#dsh-quota-card .dot-qoder{background:var(--dsw-dot-qoder,#F5319D)}',
            '#dsh-quota-capsule{width:384px;max-width:min(384px,calc(100vw - 36px));box-sizing:border-box;background:var(--dsw-surface,#FFFFFF);border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-card,8px);box-shadow:var(--dsw-shadow-card,0 4px 10px rgba(0,0,0,0.1));padding:14px 16px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;outline:none;color:inherit;font:inherit;text-align:left;transition:box-shadow .2s ease}',
            '#dsh-quota-capsule:hover{box-shadow:0 6px 16px rgba(0,0,0,0.12)}',
            '#dsh-quota-capsule:active{box-shadow:0 2px 6px rgba(0,0,0,0.08)}',
            '#dsh-quota-capsule .dsh-capsule-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--dsw-divider,#F2F3F5);margin-bottom:10px}',
            '#dsh-quota-capsule .dsh-capsule-title{font-size:14px;font-weight:600;color:var(--dsw-text-title,#1D2129)}',
            '#dsh-quota-capsule .dsh-capsule-health{display:inline-flex;align-items:center;gap:6px}',
            '#dsh-quota-capsule .dsh-capsule-health-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-color-success,#00B42A);box-shadow:0 0 0 3px var(--dsw-success-bg,#E8FFEA)}',
            '#dsh-quota-capsule .dsh-capsule-health-dot.is-warn{background:var(--dsw-color-warning,#FF7D00);box-shadow:0 0 0 3px var(--dsw-warning-bg,#FFF7E8)}',
            '#dsh-quota-capsule .dsh-capsule-health-dot.is-error{background:var(--dsw-color-error,#F53F3F);box-shadow:0 0 0 3px var(--dsw-error-bg,#FFECE8)}',
            '#dsh-quota-capsule .dsh-capsule-health-count{font-size:12px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-capsule .dsh-capsule-section{display:flex;flex-direction:column;gap:4px}',
            '#dsh-quota-capsule .dsh-capsule-section-balance{margin-top:10px;padding-top:10px;border-top:1px solid var(--dsw-divider,#F2F3F5)}',
            '#dsh-quota-capsule .dsh-capsule-section-label{font-size:11px;font-weight:500;letter-spacing:.08em;color:var(--dsw-text-tertiary,#86909C);padding:2px 0 4px}',
            '#dsh-quota-capsule .dsh-capsule-item{display:flex;flex-direction:column}',
            '#dsh-quota-capsule .dsh-capsule-item + .dsh-capsule-item{margin-top:4px}',
            '#dsh-quota-capsule .dsh-capsule-main{display:flex;align-items:center;gap:6px;min-height:24px}',
            '#dsh-quota-capsule .dsh-capsule-group-title{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--dsw-text-title,#1D2129);padding:2px 0 4px}',
            '#dsh-quota-capsule .dsh-capsule-main-sub{padding-left:14px}',
            '#dsh-quota-capsule .dsh-capsule-main-sub .dsh-capsule-label{flex:0 0 64px;font-size:12px;font-weight:400;color:var(--dsw-text-body,#4E5969)}',
            '#dsh-quota-capsule .dsh-capsule-label{flex:0 1 auto;max-width:118px;font-size:13px;font-weight:400;color:var(--dsw-text-title,#1D2129);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-capsule .dsh-capsule-bar{flex:1 1 48px;min-width:48px;height:6px;border-radius:2px;background:var(--dsw-divider,#F2F3F5);overflow:hidden;display:flex;align-items:center}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill{height:100%;border-radius:2px;background:var(--dsw-color-primary,#165DFF);transition:width .3s ease}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-ok{background:var(--dsw-color-success,#00B42A)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-warn{background:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-error{background:var(--dsw-color-error,#F53F3F)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-info{background:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-capsule .dsh-capsule-spacer{flex:1;height:1px}',
            '#dsh-quota-capsule .dsh-capsule-value{flex:0 0 36px;text-align:right;font-size:12px;font-weight:400;font-variant-numeric:tabular-nums;color:var(--dsw-text-title,#1D2129);white-space:nowrap}',
            '#dsh-quota-capsule .dsh-capsule-value.state-warn{color:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-capsule .dsh-capsule-value.state-error{color:var(--dsw-color-error,#F53F3F)}',
            '#dsh-quota-capsule .dsh-capsule-time{flex:0 0 76px;text-align:right;font-size:11px;color:var(--dsw-text-tertiary,#86909C);font-variant-numeric:tabular-nums;white-space:nowrap}',
            '#dsh-quota-capsule .dsh-capsule-tag{align-self:flex-start;margin-top:6px;padding:2px 8px;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-warning-bg,#FFF7E8);color:var(--dsw-color-warning,#FF7D00);font-size:11px;line-height:16px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-capsule .dsh-capsule-status{display:block;margin-top:8px;font-size:12px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-capsule .dsh-capsule-status.state-error{color:var(--dsw-color-error,#F53F3F)}',
            '#dsh-quota-card{width:440px;max-width:min(440px,calc(100vw - 36px));max-height:min(880px,calc(100vh - 36px));box-sizing:border-box;background:var(--dsw-surface,#FFFFFF);border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-card,8px);box-shadow:var(--dsw-shadow-card,0 4px 10px rgba(0,0,0,0.1));padding:16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overscroll-behavior:contain;transform-origin:bottom right;animation:dsh-quota-card-enter 220ms cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:var(--dsw-text-disabled,#C9CDD4) transparent}',
            '#dsh-quota-card::-webkit-scrollbar{width:4px}',
            '#dsh-quota-card::-webkit-scrollbar-thumb{background:var(--dsw-text-disabled,#C9CDD4);border-radius:2px}',
            '#dsh-quota-card .dsh-quota-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:2px;cursor:grab;user-select:none;touch-action:none}',
            '#dsh-quota-card .dsh-quota-header-left{display:flex;align-items:center;gap:8px;min-width:0}',
            '#dsh-quota-card .dsh-quota-title{font-size:14px;font-weight:600;color:var(--dsw-text-title,#1D2129)}',
            '#dsh-quota-card .dsh-quota-tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-fill-2,#F2F3F5);font-size:12px;color:var(--dsw-text-body,#4E5969);white-space:nowrap}',
            '#dsh-quota-card .dsh-quota-actions{display:flex;align-items:center;gap:4px}',
            '#dsh-quota-card .dsh-quota-icon{width:28px;height:28px;display:inline-grid;place-items:center;padding:0;border:none;background:transparent;border-radius:var(--dsw-radius-component,4px);color:var(--dsw-text-body,#4E5969);font:inherit;line-height:1;cursor:pointer;outline:none;transition:background-color .2s ease,color .2s ease}',
            '#dsh-quota-card .dsh-quota-icon:hover{background:var(--dsw-fill-2,#F2F3F5);color:var(--dsw-text-title,#1D2129)}',
            '#dsh-quota-card .dsh-quota-icon:active{background:var(--dsw-border,#E5E6EB)}',
            '#dsh-quota-card .dsh-quota-icon:focus-visible{outline:2px solid #BEDAFF;outline-offset:1px}',
            '#dsh-quota-card .dsh-quota-icon:disabled{cursor:default;opacity:0.4}',
            '#dsh-quota-card .dsh-quota-icon.is-loading{animation:dsh-quota-spin 0.75s cubic-bezier(0.4,0,0.2,1) infinite}',
            '#dsh-quota-card .dsh-quota-icon.is-active{background:var(--dsw-fill-2,#F2F3F5);color:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-card .dsh-provider-card{flex:none;background:var(--dsw-surface,#FFFFFF);border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-card,8px);padding:12px 14px;display:flex;flex-direction:column;gap:8px}',
            '#dsh-quota-card .dsh-provider-card.state-warn{border-color:#FFCF8B}',
            '#dsh-quota-card .dsh-provider-card.state-error{border-color:#FDCDC5}',
            '#dsh-quota-card .dsh-provider-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
            '#dsh-quota-card .dsh-provider-meta{display:flex;align-items:center;gap:8px;min-width:0}',
            '#dsh-quota-card .dsh-provider-name{font-size:13px;font-weight:400;color:var(--dsw-text-title,#1D2129);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-card .dsh-provider-value{font-size:13px;font-weight:400;font-variant-numeric:tabular-nums;color:var(--dsw-text-title,#1D2129);white-space:nowrap}',
            '#dsh-quota-card .dsh-provider-card.state-warn .dsh-provider-value{color:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-card .dsh-provider-card.state-error .dsh-provider-value{color:var(--dsw-color-error,#F53F3F)}',
            '#dsh-quota-card .dsh-window-item{display:flex;flex-direction:column;gap:6px}',
            '#dsh-quota-card .dsh-window-item + .dsh-window-item{margin-top:2px;padding-top:8px;border-top:1px solid var(--dsw-divider,#F2F3F5)}',
            '#dsh-quota-card .dsh-usage-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-text-body,#4E5969);font-variant-numeric:tabular-nums}',
            '#dsh-quota-card .dsh-usage-row > span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '#dsh-quota-card .dsh-reset-time{flex:none;font-size:12px;color:var(--dsw-text-tertiary,#86909C);font-variant-numeric:tabular-nums;white-space:nowrap}',
            '#dsh-quota-card .dsh-progress{width:100%;height:6px;border-radius:2px;background:var(--dsw-divider,#F2F3F5);overflow:hidden}',
            '#dsh-quota-card .dsh-progress-fill{height:100%;border-radius:2px;background:var(--dsw-color-primary,#165DFF);transition:width .3s ease}',
            '#dsh-quota-card .dsh-progress-fill.state-ok{background:var(--dsw-color-success,#00B42A)}',
            '#dsh-quota-card .dsh-progress-fill.state-warn{background:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-card .dsh-progress-fill.state-error{background:var(--dsw-color-error,#F53F3F)}',
            '#dsh-quota-card .dsh-provider-sub{font-size:12px;line-height:18px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-card .dsh-usage-caption{font-size:12px;line-height:18px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-card .dsh-rate-limit-alert{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-warning-bg,#FFF7E8);font-size:12px}',
            '#dsh-quota-card .dsh-rate-limit-icon{display:inline-flex;flex:none;color:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-card .dsh-rate-limit-text{flex:1;min-width:0;color:var(--dsw-text-body,#4E5969);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-card .dsh-rate-limit-strong{color:var(--dsw-color-warning,#FF7D00);font-weight:600}',
            '#dsh-quota-card .dsh-rate-limit-timer{flex:none;color:var(--dsw-color-warning,#FF7D00);font-variant-numeric:tabular-nums;white-space:nowrap}',
            '#dsh-quota-card .dsh-quota-error{color:var(--dsw-color-error,#F53F3F);font-size:12px;line-height:18px;word-break:break-all}',
            '#dsh-quota-card .dsh-peak-badge{display:inline-flex;align-items:center;flex:none;font-size:11px;line-height:16px;padding:0 6px;border-radius:var(--dsw-radius-component,4px)}',
            '#dsh-quota-card .dsh-peak-badge.state-peak{background:var(--dsw-warning-bg,#FFF7E8);color:var(--dsw-color-warning,#FF7D00)}',
            '#dsh-quota-card .dsh-peak-badge.state-off{background:var(--dsw-success-bg,#E8FFEA);color:var(--dsw-color-success,#00B42A)}',
            '#dsh-quota-card .dsh-quota-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid var(--dsw-divider,#F2F3F5);font-size:12px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-card .dsh-quota-footer-link{color:var(--dsw-color-primary,#165DFF);font-size:12px;cursor:pointer;text-decoration:none;white-space:nowrap;transition:color .2s ease}',
            '#dsh-quota-card .dsh-quota-footer-link:hover{color:#4080FF}',
            '#dsh-quota-card.is-settings{gap:0}',
            '#dsh-quota-card .dsh-settings-nav{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--dsw-divider,#F2F3F5);cursor:grab;user-select:none;touch-action:none}',
            '#dsh-quota-card .dsh-settings-title{font-size:14px;font-weight:600;color:var(--dsw-text-title,#1D2129)}',
            '#dsh-quota-card .dsh-settings-section{margin-top:16px}',
            '#dsh-quota-card .dsh-settings-section-label{font-size:12px;color:var(--dsw-text-tertiary,#86909C);margin-bottom:8px;padding-left:2px}',
            '#dsh-quota-card .dsh-settings-list{background:var(--dsw-surface,#FFFFFF);border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-card,8px);overflow:hidden}',
            '#dsh-quota-card .dsh-settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:40px;padding:6px 12px;font-size:13px;color:var(--dsw-text-title,#1D2129);position:relative}',
            '#dsh-quota-card .dsh-settings-row + .dsh-settings-row::before{content:\'\';position:absolute;top:0;left:12px;right:12px;height:1px;background:var(--dsw-divider,#F2F3F5)}',
            '#dsh-quota-card .dsh-settings-row.is-column{flex-direction:column;align-items:stretch;gap:10px;padding:10px 12px}',
            '#dsh-quota-card .dsh-settings-name-wrap{display:flex;align-items:center;gap:8px;min-width:0;flex:1}',
            '#dsh-quota-card .dsh-settings-name{font-size:13px;color:var(--dsw-text-title,#1D2129);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-card .dsh-settings-kind{flex:none;font-size:11px;line-height:16px;padding:0 6px;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-fill-2,#F2F3F5);color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-card .dsh-settings-status-tag{flex:none;font-size:11px;line-height:16px;padding:0 6px;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-success-bg,#E8FFEA);color:var(--dsw-color-success,#00B42A)}',
            '#dsh-quota-card .dsh-settings-switch{position:relative;display:inline-flex;cursor:pointer;flex:none}',
            '#dsh-quota-card .dsh-settings-switch input{position:absolute;opacity:0;width:0;height:0;margin:0}',
            '#dsh-quota-card .dsh-settings-switch-track{display:block;width:34px;height:18px;border-radius:999px;background:var(--dsw-text-disabled,#C9CDD4);position:relative;transition:background-color .2s ease}',
            '#dsh-quota-card .dsh-settings-switch-track::after{content:\'\';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-surface,#FFFFFF);box-shadow:0 1px 2px rgba(0,0,0,0.2);transition:transform .2s ease}',
            '#dsh-quota-card .dsh-settings-switch input:checked + .dsh-settings-switch-track{background:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-card .dsh-settings-switch input:checked + .dsh-settings-switch-track::after{transform:translateX(16px)}',
            '#dsh-quota-card .dsh-settings-switch input:focus-visible + .dsh-settings-switch-track{box-shadow:0 0 0 2px #BEDAFF}',
            '#dsh-quota-card .dsh-settings-input,#dsh-quota-card .dsh-settings-select{height:28px;padding:0 8px;border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-component,4px);background:var(--dsw-surface,#FFFFFF);color:var(--dsw-text-title,#1D2129);font-family:inherit;font-size:12px;outline:none;transition:border-color .2s ease}',
            '#dsh-quota-card .dsh-settings-input:focus,#dsh-quota-card .dsh-settings-select:focus{border-color:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-card .dsh-settings-number{width:92px;text-align:right;font-variant-numeric:tabular-nums}',
            '#dsh-quota-card .dsh-settings-proxy{width:164px;font-size:12px}',
            '#dsh-quota-card .dsh-settings-select{width:132px;appearance:none;-webkit-appearance:none;padding-right:26px;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 48 48\' fill=\'none\'%3E%3Cpath d=\'M14 20l10 10 10-10\' stroke=\'%2386909C\' stroke-width=\'4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}',
            '#dsh-quota-card .dsh-settings-radio-group{display:flex;align-items:center;gap:16px;flex-wrap:wrap}',
            '#dsh-quota-card .dsh-settings-radio{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--dsw-text-body,#4E5969);position:relative}',
            '#dsh-quota-card .dsh-settings-radio input{position:absolute;opacity:0;width:0;height:0;margin:0}',
            '#dsh-quota-card .dsh-settings-radio-box{width:14px;height:14px;border-radius:50%;border:1px solid var(--dsw-text-disabled,#C9CDD4);background:var(--dsw-surface,#FFFFFF);position:relative;transition:border-color .2s ease}',
            '#dsh-quota-card .dsh-settings-radio input:checked + .dsh-settings-radio-box{border-color:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-card .dsh-settings-radio input:checked + .dsh-settings-radio-box::after{content:\'\';position:absolute;inset:0;margin:auto;width:6px;height:6px;border-radius:50%;background:var(--dsw-color-primary,#165DFF)}',
            '#dsh-quota-card .dsh-settings-btn-secondary{height:26px;padding:0 10px;border:none;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-fill-2,#F2F3F5);color:var(--dsw-text-body,#4E5969);font-family:inherit;font-size:12px;cursor:pointer;flex:none;transition:background-color .2s ease}',
            '#dsh-quota-card .dsh-settings-btn-secondary:hover{background:var(--dsw-border,#E5E6EB)}',
            '#dsh-quota-card .dsh-settings-btn-secondary:disabled{opacity:0.4;cursor:default}',
            '#dsh-quota-card .dsh-device-code-box{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding:10px 12px;background:var(--dsw-fill,#F7F8FA);border:1px solid var(--dsw-border,#E5E6EB);border-radius:var(--dsw-radius-component,4px)}',
            '#dsh-quota-card .dsh-device-code-label{font-size:12px;color:var(--dsw-text-tertiary,#86909C);flex:none}',
            '#dsh-quota-card .dsh-device-code{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace);font-size:15px;font-weight:600;letter-spacing:2px;color:var(--dsw-text-title,#1D2129);font-variant-numeric:tabular-nums}',
            '#dsh-quota-card .dsh-device-code-hint{font-size:11px;line-height:16px;color:var(--dsw-text-tertiary,#86909C);margin-top:6px;padding:0 2px}',
            '#dsh-quota-card .dsh-settings-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px;padding-top:12px;border-top:1px solid var(--dsw-divider,#F2F3F5)}',
            '#dsh-quota-card .dsh-settings-hint{font-size:12px;color:var(--dsw-text-tertiary,#86909C)}',
            '#dsh-quota-card .dsh-chatgpt-url a{color:var(--dsw-color-primary,#165DFF);font-size:12px;line-height:18px;word-break:break-all;text-decoration:none}',
            '#dsh-quota-card .dsh-chatgpt-url a:hover{color:#4080FF}',
            '#dsh-quota-card .dsh-settings-btn-danger{height:30px;padding:0 14px;border:none;border-radius:var(--dsw-radius-component,4px);background:var(--dsw-color-error,#F53F3F);color:#FFF;font-family:inherit;font-size:13px;cursor:pointer;flex:none;transition:background-color .2s ease}',
            '#dsh-quota-card .dsh-settings-btn-danger:hover{background:#F76560}',
            '#dsh-quota-card .dsh-settings-btn-danger:active{background:#CB2634}',
            '@keyframes dsh-quota-spin{to{transform:rotate(360deg)}}',
            '@keyframes dsh-quota-card-enter{from{opacity:0;transform:scale(0.96) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}',
            '@media (prefers-reduced-motion: reduce){#dsh-quota-capsule,#dsh-quota-card,#dsh-quota-capsule .dsh-capsule-bar-fill,#dsh-quota-card .dsh-progress-fill,#dsh-quota-card .dsh-quota-icon,#dsh-quota-card .dsh-quota-icon.is-loading,#dsh-quota-card .dsh-quota-footer-link,#dsh-quota-card .dsh-settings-switch-track,#dsh-quota-card .dsh-settings-switch-track::after,#dsh-quota-card .dsh-settings-radio-box,#dsh-quota-card .dsh-settings-input,#dsh-quota-card .dsh-settings-select,#dsh-quota-card .dsh-settings-btn-secondary,#dsh-quota-card .dsh-settings-btn-danger{transition:none;animation:none}}'
        ].join("\n");
        var CAPSULE_CHOICES = [
            { value: "auto" },
            { value: "rolling" },
            { value: "weekly" },
            { value: "max" }
        ];
        var CAPSULE_MODES = { auto: true, rolling: true, weekly: true, max: true };
        // Fixed display order for the collapsed capsule (replaces the dynamic
        // status-weight sort): ids not listed fall to the end, ties keep the
        // spec order.
        var FIXED_ORDER = ["chatgpt", "zai-coding-cn", "antigravity-gemini", "antigravity-claude", "workbuddy-cn", "workbuddy-global", "deepseek", "qoder"];
        // Collapsed-capsule sub-row labels carry the full window name.
        var WIN_FULL_LABELS = { "5h": "5小时额度", "周": "周额度", "月": "月额度" };
        var winFullLabel = function (label) { return WIN_FULL_LABELS[label] || label || "?"; };
        // Provider pool dot colour (Arco token per the design mock), keyed by
        // spec id. An unmapped id THROWS: a new host provider must be added
        // here explicitly, never silently uncoloured.
        var POOL_DOT_BY_ID = {
            "chatgpt": "dot-chatgpt",
            "zai-coding-cn": "dot-zhipu",
            "antigravity-gemini": "dot-aggemini",
            "antigravity-claude": "dot-agclaude",
            "workbuddy-cn": "dot-workbuddy",
            "workbuddy-global": "dot-workbuddy",
            "deepseek": "dot-deepseek",
            "qoder": "dot-qoder"
        };
        function poolDotClass(id) {
            var cls = POOL_DOT_BY_ID[id];
            if (!cls)
                throw new Error("dsh-quota-panel: no pool dot colour mapped for provider id: " + id);
            return cls;
        }
        // Collapsed-capsule sections (design mock): usage pools on top, the
        // balance pools below the divider. Ids outside this list render in
        // the balance section (and throw on the dot lookup above).
        var USAGE_POOL_IDS = { "chatgpt": true, "zai-coding-cn": true, "antigravity-gemini": true, "antigravity-claude": true };
        // Inline SVG icons (Arco outline style; stroke follows text colour).
        var ICON_REFRESH = React.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }), React.createElement("polyline", { points: "21 3 21 9 15 9" }));
        var ICON_GEAR = React.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("circle", { cx: "12", cy: "12", r: "3" }), React.createElement("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" }));
        var ICON_COLLAPSE = React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("polyline", { points: "6 15 12 9 18 15" }));
        var ICON_CLOSE = React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }, React.createElement("path", { d: "M5 5l14 14M19 5L5 19" }));
        var ICON_RATE_LIMIT = React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 48 48", fill: "none" }, React.createElement("path", { d: "M23.62 6.59a.9.9 0 0 0-1.56 0L4.13 38.53a.9.9 0 0 0 .78 1.35h38.18a.9.9 0 0 0 .78-1.35L23.62 6.59z", fill: "currentColor", opacity: ".18" }), React.createElement("path", { d: "M24 18v12", stroke: "currentColor", strokeWidth: "4", strokeLinecap: "round" }), React.createElement("circle", { cx: "24", cy: "37", r: "2.5", fill: "currentColor" }));
        function readSettings() {
            var base = { hidden: {}, refreshMs: null, warn: {}, proxy: {}, capsuleMode: null, position: null, holidays: "" };
            try {
                var raw = globalThis.localStorage.getItem(STORAGE_KEY);
                if (raw === null)
                    return base;
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    if (parsed.hidden && typeof parsed.hidden === "object")
                        base.hidden = parsed.hidden;
                    if (typeof parsed.refreshMs === "number" && Number.isFinite(parsed.refreshMs) && parsed.refreshMs >= 5000)
                        base.refreshMs = parsed.refreshMs;
                    if (parsed.warn && typeof parsed.warn === "object")
                        base.warn = parsed.warn;
                    if (parsed.proxy && typeof parsed.proxy === "object")
                        base.proxy = parsed.proxy;
                    if (typeof parsed.capsuleMode === "string" && CAPSULE_MODES[parsed.capsuleMode])
                        base.capsuleMode = parsed.capsuleMode;
                    if (parsed.position && typeof parsed.position === "object" && Number.isFinite(parsed.position.x) && Number.isFinite(parsed.position.y)) {
                        base.position = { x: parsed.position.x, y: parsed.position.y };
                    }
                }
            }
            catch (err) { }
            return base;
        }
        function writeSettings(settings) {
            try {
                globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            }
            catch (err) { }
        }
        /** Absolute reset time in 24h local format: 2026-08-15 14:00. */
        function fmtNextReset(t, iso) {
            var d = new Date(iso);
            if (!isFinite(d.getTime()))
                return "";
            var pad = function (n) { return (n < 10 ? "0" : "") + n; };
            return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
        }
        /** Compact reset time for inline window segments: HH:MM when the
         * reset lands today, otherwise MM-DD HH:MM. Empty when unparseable. */
        function fmtShortReset(iso) {
            var d = new Date(iso);
            if (!isFinite(d.getTime()))
                return "";
            var pad = function (n) { return (n < 10 ? "0" : "") + n; };
            var hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
            var now = new Date();
            if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate())
                return hm;
            return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + hm;
        }
        // Dragged-panel geometry: pointer travel before a gesture counts as a
        // drag (below it the click-to-expand still fires) and the viewport
        // edge margin. The stored point is the panel's BOTTOM-RIGHT corner:
        // every size (capsule / card / card+settings) grows toward the
        // top-left from that shared anchor, so expanding never shifts the
        // corner the user placed.
        var DRAG_THRESHOLD = 5;
        var DRAG_EDGE = 8;
        /** Clamp the bottom-right corner so the capsule stays grabbable. */
        function clampPos(x, y, vw, vh) {
            var maxX = Math.max(DRAG_EDGE, vw - DRAG_EDGE);
            var maxY = Math.max(DRAG_EDGE, vh - DRAG_EDGE);
            return {
                x: Math.min(Math.max(x, DRAG_EDGE), maxX),
                y: Math.min(Math.max(y, DRAG_EDGE), maxY)
            };
        }
        /** Effective balance tiers with the local warn override applied. */
        function effectiveTiers(spec, warnOverride) {
            var tiers = spec.balanceTiers || { critical: 10, warn: 20, healthy: 50 };
            if (typeof warnOverride === "number" && Number.isFinite(warnOverride) && warnOverride >= 0) {
                return { critical: warnOverride / 2, warn: warnOverride, healthy: tiers.healthy };
            }
            return tiers;
        }
        /** Effective usage thresholds with the local warn override applied. */
        function effectivePercents(spec, warnOverride) {
            var warn = typeof warnOverride === "number" && Number.isFinite(warnOverride) && warnOverride >= 0 ? warnOverride : (spec.warnPercent || 70);
            var error = Math.max(spec.errorPercent || 90, warn + 1);
            return { warn: warn, error: Math.min(error, 100) };
        }
        /**
         * Row view model: status + texts for one provider spec + its
         * host-normalized view (kind balance / usage / info). Threshold
         * judgement stays client-side so local settings overrides apply
         * without a refetch.
         */
        function rowView(t, spec, entry, warnOverride, modeOverride) {
            var kind = spec.kind || "balance";
            var unavailable = kind === "usage" ? t("usageUnavailable") : kind === "info" ? t("quotaUnavailable") : t("balanceUnavailable");
            if (!entry || entry.error) {
                return {
                    kind: kind, status: "error", summary: "—", value: "—",
                    sub: unavailable, usageText: null, barPercent: 0, caption: "",
                    title: entry && entry.error ? String(entry.error) : "no data"
                };
            }
            var view = entry.view || {};
            if (view.kind === "usage") {
                var w = view.windows || {};
                var winPct = function (name) {
                    var win = w[name];
                    return win && typeof win.percent === "number" && Number.isFinite(win.percent) ? win.percent : null;
                };
                var rp = winPct("rolling");
                var wp = winPct("weekly");
                var mp = winPct("monthly");
                var present = [rp, wp, mp].filter(function (v) { return v !== null; });
                var high = present.length ? Math.max.apply(null, present) : 0;
                var localizeWin = function (label) {
                    return label === "滚" ? t("winRolling") : label === "周" ? t("winWeekly") : label === "月" ? t("winMonthly") : label === "搜索" ? t("winSearch") : label;
                };
                var specLabels = spec.windowLabels || {};
                var labels = {
                    rolling: localizeWin(specLabels.rolling || t("winRolling")),
                    weekly: localizeWin(specLabels.weekly || t("winWeekly")),
                    monthly: localizeWin(specLabels.monthly || t("winMonthly"))
                };
                var pcts = effectivePercents(spec, warnOverride);
                // Capsule display mode (issue #2 follow-up): which window the
                // collapsed capsule follows. auto/max keep the historical
                // highest-window glance; rolling/weekly pin it to one window and
                // the status dot / bar / caption align with the SHOWN value (a
                // 5h capsule no longer glows warn because the weekly pool is
                // high). A window the plan does not carry falls back to the
                // highest, so nothing regresses for single-window plans.
                var mode = modeOverride ?? spec.capsuleMode;
                if (mode !== "rolling" && mode !== "weekly")
                    mode = "auto";
                var shownPct, shownWin;
                if (mode === "rolling" && rp !== null) {
                    shownPct = rp;
                    shownWin = w.rolling;
                }
                else if (mode === "weekly" && wp !== null) {
                    shownPct = wp;
                    shownWin = w.weekly;
                }
                else {
                    shownPct = high;
                    shownWin = null;
                }
                var status = shownPct >= pcts.error ? "error" : shownPct >= pcts.warn ? "warn" : "ok";
                // Weekly absent -> the segment is dropped entirely; the search/MCP
                // lane unknown (null) -> "-%" instead of a fabricated 0%.
                // Each window segment carries its reset time inline (GLM Coding
                // pain point: the 5h refresh / weekly-monthly resets used to
                // live only in the hover title). Same-day resets collapse to
                // HH:MM; cross-day ones keep the date. The monthly lane keeps
                // the historical "-%" placeholder via the same em-dash path.
                var fmtWin = function (label, v, win = null) {
                    var seg = label + " " + (v === null ? "—" : v + "%");
                    if (win && win.resetsAt) {
                        var short = fmtShortReset(win.resetsAt);
                        if (short)
                            seg += " (" + short + ")";
                    }
                    return seg;
                };
                var titleLine = function (label, v, win) {
                    return label + ": " + (v === null ? t("noWinData") : v + "% · " + t("nextReset", { time: fmtNextReset(t, win && win.resetsAt) }));
                };
                // Weekly-only plans (ChatGPT Plus / Codex, Kimi weekly) have no
                // rolling or monthly window. Drop the empty 滚 / 月 noise and
                // surface the weekly reset time inline — it otherwise lives
                // only in the hover title.
                var weeklyOnly = rp === null && wp !== null && mp === null;
                var textSegs;
                if (weeklyOnly) {
                    // No win argument here: the branch below already pushes the
                    // full nextReset segment, a second inline time would dupe.
                    textSegs = [fmtWin(labels.weekly, wp)];
                    if (w.weekly && w.weekly.resetsAt) {
                        textSegs.push(t("nextReset", { time: fmtNextReset(t, w.weekly.resetsAt) }));
                    }
                }
                else {
                    // A window the plan does not carry is omitted entirely
                    // (no "月 —" placeholder); a carried window whose percent
                    // is unknown keeps its em-dash. Segments push only when
                    // the window exists, so the " · " join never leaves a
                    // dangling separator when the last segment is missing.
                    textSegs = [];
                    if (w.rolling)
                        textSegs.push(fmtWin(labels.rolling, rp, w.rolling));
                    if (w.weekly)
                        textSegs.push(fmtWin(labels.weekly, wp, w.weekly));
                    if (w.monthly)
                        textSegs.push(fmtWin(labels.monthly, mp, w.monthly));
                }
                var titleLines = [titleLine(labels.rolling, rp, w.rolling)];
                if (wp !== null)
                    titleLines.push(titleLine(labels.weekly, wp, w.weekly));
                titleLines.push(titleLine(labels.monthly, mp, w.monthly));
                // At 100% the caption appends the reset time of the exhausted
                // window — the SHOWN window first, then any exhausted one, then
                // any window's reset as fallback:
                //   当前已使用 100% 等待重置 2026-08-15 16:00
                var exhaustedReset = null;
                if (shownPct >= 100) {
                    var cands = [];
                    if (shownWin && shownWin.resetsAt)
                        cands.push(shownWin.resetsAt);
                    if (rp !== null && rp >= 100 && w.rolling && w.rolling.resetsAt)
                        cands.push(w.rolling.resetsAt);
                    if (wp !== null && wp >= 100 && w.weekly && w.weekly.resetsAt)
                        cands.push(w.weekly.resetsAt);
                    if (mp !== null && mp >= 100 && w.monthly && w.monthly.resetsAt)
                        cands.push(w.monthly.resetsAt);
                    if (cands.length === 0) {
                        for (var wn = 0; wn < 3; wn++) {
                            var wname = ["rolling", "weekly", "monthly"][wn];
                            if (w[wname] && w[wname].resetsAt) {
                                cands.push(w[wname].resetsAt);
                                break;
                            }
                        }
                    }
                    exhaustedReset = cands.length > 0 ? cands[0] : null;
                }
                // Per-window rows for the collapsed capsule ("reset cards"):
                // each carried window becomes its own row (5h / 周 / 月), so a
                // plan with both a 5h and a weekly window shows both.
                var windowsList = [];
                if (w.rolling)
                    windowsList.push({ label: labels.rolling, percent: rp, resetsAt: w.rolling.resetsAt });
                if (w.weekly)
                    windowsList.push({ label: labels.weekly, percent: wp, resetsAt: w.weekly.resetsAt });
                if (w.monthly)
                    windowsList.push({ label: labels.monthly, percent: mp, resetsAt: w.monthly.resetsAt });
                return {
                    kind: "usage", status: status, summary: shownPct + "%", value: null,
                    usageText: textSegs.join(" · "),
                    windowsList: windowsList,
                    barPercent: Math.min(Math.max(shownPct, 0), 100),
                    caption: exhaustedReset !== null
                        ? t("peakUsageWaiting", { pct: shownPct, time: fmtNextReset(t, exhaustedReset) })
                        : t("peakUsage", { pct: shownPct }),
                    title: titleLines.join("\n")
                };
            }
            if (view.kind === "info") {
                var text = String(view.text || "—");
                return {
                    kind: "info", status: "info",
                    summary: text.length > 12 ? text.slice(0, 12) + "…" : text, value: null,
                    sub: text, usageText: null, barPercent: 0, caption: "",
                    title: view.title || ""
                };
            }
            var amount = Number(view.amount);
            if (!Number.isFinite(amount)) {
                return {
                    kind: "balance", status: "error", summary: "—", value: "—",
                    sub: t("balanceAbnormal"), usageText: null, barPercent: 0, caption: "",
                    title: "non-numeric amount"
                };
            }
            var tiers = effectiveTiers(spec, warnOverride);
            var status2, sub;
            // Rate-limited balance rows (WorkBuddy 429 soft-rate window)
            // outrank the tier judgement: the dot turns error and the sub
            // line carries the countdown even while the remaining amount
            // itself still looks healthy.
            if (view.rateLimited === true) {
                status2 = "error";
                var rateReset = typeof view.rateLimitResetsAt === "string" && view.rateLimitResetsAt ? fmtShortReset(view.rateLimitResetsAt) : "";
                var rateModel = typeof view.rateLimitModel === "string" && view.rateLimitModel ? view.rateLimitModel : "";
                if (rateModel && rateReset) {
                    sub = t("rateLimitedResetWithModel", { model: rateModel, time: rateReset });
                }
                else if (rateModel) {
                    sub = t("rateLimitedWithModel", { model: rateModel });
                }
                else if (rateReset) {
                    sub = t("rateLimitedReset", { time: rateReset });
                }
                else {
                    sub = t("rateLimited");
                }
            }
            else if (amount <= tiers.critical) {
                status2 = "error";
                sub = t("balanceCritical");
            }
            else if (amount <= tiers.warn) {
                status2 = "warn";
                sub = t("balanceWarn");
            }
            else if (amount <= tiers.healthy) {
                status2 = "ok";
                sub = t("balanceOk");
            }
            else {
                status2 = "ok";
                sub = t("balanceRich");
            }
            var shown = (spec.currency || "¥") + (Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(2));
            return {
                kind: "balance", status: status2, summary: shown,
                value: shown, sub: sub, usageText: null, barPercent: 0, caption: "",
                rateLimited: view.rateLimited === true,
                title: view.title || ""
            };
        }
        /**
         * Peak/off-peak badge for providers with differential pricing windows.
         * GLM coding (zai / zai-coding-cn): peak = Mon-Fri 14:00-18:00 UTC+8;
         * off-peak credits bill at 50%. DeepSeek: peak = Mon-Fri 09:00-12:00
         * and 14:00-18:00 Beijing time excluding the user-configured holiday
         * list (comma-separated YYYY-MM-DD in settings; empty = weekends
         * only — no holiday data is fabricated); off-peak price is half.
         * GLM's definition ignores the holiday list (the user's spec only
         * said weekdays). Recomputed on every render, so the badge follows
         * the refresh cycle. Returns null for every other provider.
         */
        function peakStatus(providerId, holidaysRaw) {
            var kind = null;
            if (providerId === "zai-coding-cn" || providerId === "zai")
                kind = "glm";
            else if (providerId === "deepseek")
                kind = "ds";
            if (kind === null)
                return null;
            var now = new Date(Date.now() + 8 * 3600e3); // UTC+8 wall clock
            var pad = function (n) { return (n < 10 ? "0" : "") + n; };
            var day = now.getUTCDay();
            var minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            var weekday = day >= 1 && day <= 5;
            var inPeak;
            if (kind === "glm") {
                inPeak = weekday && minutes >= 14 * 60 && minutes < 18 * 60;
            }
            else {
                var holidays = String(holidaysRaw || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
                var today = now.getUTCFullYear() + "-" + pad(now.getUTCMonth() + 1) + "-" + pad(now.getUTCDate());
                var workday = weekday && holidays.indexOf(today) === -1;
                inPeak = workday && ((minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60));
            }
            return { inPeak: inPeak, kind: kind };
        }
        /**
         * One collapsed-capsule item (Arco mock): a single-window provider
         * renders one dot+name row; a multi-window usage provider renders a
         * group title (dot + name) plus one indented row per carried window;
         * balance rows show a spacer instead of a bar. The 429 soft-rate
         * badge renders as the mock's warning tag under the row(s).
         */
        function capsuleItem(spec, view, warnOverride) {
            var dotCls = poolDotClass(spec.id);
            var mainRow = function (key, isSub, labelText, pct, status, valueText, timeText) {
                var rowKids = [];
                if (!isSub)
                    rowKids.push(React.createElement("span", { key: "dot", className: "dsh-capsule-pool-dot " + dotCls }));
                rowKids.push(React.createElement("span", { key: "label", className: "dsh-capsule-label", title: labelText }, labelText));
                if (pct !== null && typeof pct === "number" && Number.isFinite(pct)) {
                    rowKids.push(React.createElement("span", { key: "bar", className: "dsh-capsule-bar" }, React.createElement("span", {
                        className: "dsh-capsule-bar-fill state-" + (status || "ok"),
                        style: { width: Math.min(Math.max(pct, 0), 100) + "%" }
                    })));
                }
                else {
                    rowKids.push(React.createElement("span", { key: "spacer", className: "dsh-capsule-spacer" }));
                }
                rowKids.push(React.createElement("span", {
                    key: "value",
                    className: "dsh-capsule-value" + (status === "warn" || status === "error" ? " state-" + status : "")
                }, valueText));
                if (timeText)
                    rowKids.push(React.createElement("span", { key: "time", className: "dsh-capsule-time" }, "(" + timeText + ")"));
                return React.createElement("div", { key: key, className: "dsh-capsule-main" + (isSub ? " dsh-capsule-main-sub" : "") }, rowKids);
            };
            var kids = [];
            var winList = view.kind === "usage" && Array.isArray(view.windowsList) ? view.windowsList : [];
            // Usage providers ALL use the same group structure (title + window
            // sub-rows), single-window ones included, so ChatGPT (weekly only)
            // renders identically to the 5h+weekly pools — one visual grammar.
            if (winList.length >= 1) {
                var warnPct = typeof warnOverride === "number" && Number.isFinite(warnOverride) && warnOverride >= 0 ? warnOverride : (spec.warnPercent || 70);
                var errPct = Math.max(spec.errorPercent || 90, warnPct + 1);
                kids.push(React.createElement("div", { key: spec.id + "-gtitle", className: "dsh-capsule-group-title" }, React.createElement("span", { className: "dsh-capsule-pool-dot " + dotCls }), spec.label));
                for (var wi = 0; wi < winList.length; wi++) {
                    var wrow = winList[wi];
                    var wst = wrow.percent >= errPct ? "error" : wrow.percent >= warnPct ? "warn" : "ok";
                    kids.push(mainRow(spec.id + "-w" + wi, true, winFullLabel(wrow.label), wrow.percent, wst, wrow.percent === null ? "—" : wrow.percent + "%", wrow.resetsAt ? fmtShortReset(wrow.resetsAt) : ""));
                }
            }
            else {
                kids.push(mainRow(spec.id + "-main", false, spec.label, view.kind === "usage" && typeof view.barPercent === "number" && Number.isFinite(view.barPercent) ? view.barPercent : null, view.status, view.summary || "—", ""));
            }
            if (view.kind === "balance" && view.rateLimited && view.sub) {
                kids.push(React.createElement("div", { key: "tag", className: "dsh-capsule-tag", title: view.sub }, view.sub));
            }
            return React.createElement("div", { key: spec.id + "-item", className: "dsh-capsule-item", title: view.title || "" }, kids);
        }
        function ProviderRow(props) {
            var spec = props.spec;
            var view = props.view;
            var t = props.t;
            var meta = [
                React.createElement("span", { key: "dot", className: "dsh-pool-dot " + poolDotClass(spec.id) }),
                React.createElement("span", { key: "name", className: "dsh-provider-name" }, spec.label)
            ];
            var peak = t ? peakStatus(spec.id, props.holidays) : null;
            if (peak) {
                var peakText = peak.inPeak ? t("peakBadge") : t(peak.kind === "glm" ? "offPeak50" : "offPeakHalf");
                meta.push(React.createElement("span", {
                    key: "peak",
                    className: "dsh-peak-badge state-" + (peak.inPeak ? "peak" : "off")
                }, peakText));
            }
            var body = [React.createElement("div", { key: "head", className: "dsh-provider-head" }, React.createElement("div", { className: "dsh-provider-meta" }, meta), React.createElement("span", { className: "dsh-provider-value" }, view.summary || "—"))];
            if (view.kind === "usage") {
                // One window-item per carried window: detail row + progress
                // track, per-window fill colour judged from the same local
                // thresholds the capsule uses.
                var pcts = effectivePercents(spec, props.warn);
                var winList = Array.isArray(view.windowsList) ? view.windowsList : [];
                for (var wi = 0; wi < winList.length; wi++) {
                    var wrow = winList[wi];
                    var wpct = typeof wrow.percent === "number" && Number.isFinite(wrow.percent) ? Math.min(Math.max(wrow.percent, 0), 100) : 0;
                    var wst = wrow.percent === null ? view.status : wrow.percent >= pcts.error ? "error" : wrow.percent >= pcts.warn ? "warn" : "ok";
                    var itemKids = [React.createElement("div", { key: "row", className: "dsh-usage-row" }, React.createElement("span", null, winFullLabel(wrow.label) + ": " + (wrow.percent === null ? "—" : wrow.percent + "%")), wrow.resetsAt ? React.createElement("span", { className: "dsh-reset-time" }, t("nextReset", { time: fmtShortReset(wrow.resetsAt) || fmtNextReset(t, wrow.resetsAt) })) : null)];
                    itemKids.push(React.createElement("div", { key: "track", className: "dsh-progress" }, React.createElement("div", { className: "dsh-progress-fill state-" + wst, style: { width: wpct + "%" } })));
                    body.push(React.createElement("div", { key: "w" + wi, className: "dsh-window-item" }, itemKids));
                }
                if (view.caption)
                    body.push(React.createElement("div", { key: "cap", className: "dsh-usage-caption" }, view.caption));
            }
            else if (view.rateLimited && view.sub) {
                // Soft-rate (429) window: the mock's warning Alert (icon +
                // text). view.sub is one host-composed string, so it stays a
                // single strong segment — no data-logic split here.
                body.push(React.createElement("div", { key: "rate", className: "dsh-rate-limit-alert" }, React.createElement("span", { className: "dsh-rate-limit-icon" }, ICON_RATE_LIMIT), React.createElement("span", { className: "dsh-rate-limit-text" }, React.createElement("span", { className: "dsh-rate-limit-strong" }, view.sub))));
            }
            else if (view.sub) {
                body.push(React.createElement("div", { key: "sub", className: "dsh-provider-sub" }, view.sub));
            }
            return React.createElement("div", { className: "dsh-provider-card state-" + view.status, title: view.title }, body);
        }
        /**
         * ChatGPT account section. Self-contained: it queries the host's
         * chatgpt-auth-* RPC endpoints and renders either a login button
         * (which kicks off the device-code flow and shows the one-time code +
         * verification URL) or a signed-in state with a log-out button.
         * Secrets never reach this component — only status and codes.
         */
        function ChatGPTAccount(props) {
            var t = props.t;
            var call = props.call;
            var settings = props.settings;
            var onChange = props.onChange;
            var statusState = React.useState(null);
            var status = statusState[0], setStatus = statusState[1];
            var busyState = React.useState(false);
            var busy = busyState[0], setBusy = busyState[1];
            var errorState = React.useState(null);
            var errorMsg = errorState[0], setError = errorState[1];
            var copiedState = React.useState(false);
            var copied = copiedState[0], setCopied = copiedState[1];
            var pollRef = React.useRef(null);
            // Proxy for the ChatGPT login flow AND its usage queries: stored
            // under settings.proxy.chatgpt — the same key fetch-all already
            // forwards as the per-row proxy override, so login and querying
            // share one configuration.
            var cgProxy = settings && settings.proxy && typeof settings.proxy.chatgpt === "string" ? settings.proxy.chatgpt : "";
            function setProxy(value) {
                var trimmed = String(value).trim();
                var proxy = Object.assign({}, settings && settings.proxy);
                if (trimmed === "")
                    delete proxy.chatgpt;
                else
                    proxy.chatgpt = trimmed;
                onChange(Object.assign({}, settings, { proxy: proxy }));
            }
            function sourceLabel(src) {
                return src === "codex" ? t("chatgptSourceCodex") : t("chatgptSourceDsh");
            }
            function refresh() {
                return call("chatgpt-auth-status", null).then(function (r) {
                    if (r && r.ok)
                        setStatus(r.value);
                }).catch(function () { });
            }
            React.useEffect(function () {
                refresh();
                // While a login is in-flight, poll for completion; the host
                // flips `login.active` to false when it obtains tokens (or,
                // on failure, records the terminal error in login.error).
                var timer = setInterval(function () {
                    call("chatgpt-auth-status", null).then(function (r) {
                        if (r && r.ok) {
                            setStatus(r.value);
                            if (!r.value.login || !r.value.login.active) {
                                setBusy(false);
                                if (r.value.login && r.value.login.error) {
                                    setError(r.value.login.error);
                                }
                            }
                        }
                    }).catch(function () { });
                }, 2500);
                pollRef.current = timer;
                return function () { clearInterval(timer); };
            }, []);
            function startLogin() {
                setError(null);
                setBusy(true);
                call("chatgpt-login-start", { proxy: cgProxy || null }).then(function (r) {
                    if (!r || !r.ok) {
                        setBusy(false);
                        setError((r && r.error && r.error.message) || "failed");
                    }
                    // The host returns { verificationUrl, userCode }; refresh
                    // status so the in-flight code renders.
                    return refresh();
                }).catch(function (e) {
                    setBusy(false);
                    setError(String(e && e.message ? e.message : e));
                });
            }
            function cancelLogin() {
                call("chatgpt-login-cancel", null).then(function () { setBusy(false); return refresh(); });
            }
            function logout() {
                call("chatgpt-logout", null).then(function () { return refresh(); });
            }
            function copyCode(code) {
                try {
                    navigator.clipboard.writeText(code).then(function () {
                        setCopied(true);
                        setTimeout(function () { setCopied(false); }, 1500);
                    }).catch(function () { });
                }
                catch (e) { /* clipboard may be unavailable */ }
            }
            var login = status && status.login;
            var inFlight = busy || (login && login.active);
            var children = [];
            var extras = [];
            if (status && status.loggedIn && !(login && login.active)) {
                children.push(React.createElement("div", { key: "in", className: "dsh-settings-row" }, React.createElement("div", { className: "dsh-settings-name-wrap" }, React.createElement("span", { className: "dsh-pool-dot " + poolDotClass("chatgpt") }), React.createElement("span", { className: "dsh-settings-name" }, t("chatgptAccount"))), React.createElement("span", { className: "dsh-settings-status-tag" }, t("chatgptLoggedIn", { source: sourceLabel(status.source) })), React.createElement("button", { className: "dsh-settings-btn-secondary", type: "button", onClick: logout }, t("chatgptLogout"))));
                if (status.plan_type) {
                    extras.push(React.createElement("div", { key: "plan", className: "dsh-device-code-hint" }, t("chatgptPlan", { plan: status.plan_type })));
                }
            }
            else if (inFlight && login && login.userCode) {
                // Device-code flow (mock device-code-box): hint / URL / one-time
                // code + copy / waiting / cancel, stacked below the section list.
                extras.push(React.createElement("div", { key: "s1", className: "dsh-device-code-hint" }, t("chatgptLoginStep1")));
                extras.push(React.createElement("div", { key: "url", className: "dsh-chatgpt-url" }, React.createElement("a", { href: login.verificationUrl, target: "_blank", rel: "noreferrer" }, login.verificationUrl)));
                extras.push(React.createElement("div", { key: "s2", className: "dsh-device-code-hint" }, t("chatgptLoginStep2")));
                extras.push(React.createElement("div", { key: "code", className: "dsh-device-code-box" }, React.createElement("span", { className: "dsh-device-code" }, login.userCode), React.createElement("button", {
                    className: "dsh-settings-btn-secondary", type: "button",
                    onClick: function () { copyCode(login.userCode); }
                }, copied ? t("chatgptCopied") : t("chatgptCopy"))));
                extras.push(React.createElement("div", { key: "wait", className: "dsh-device-code-hint" }, t("chatgptWaiting")));
                extras.push(React.createElement("button", {
                    key: "cancel", className: "dsh-settings-btn-secondary", type: "button",
                    style: { marginTop: "6px" }, onClick: cancelLogin
                }, t("chatgptCancel")));
            }
            else {
                children.push(React.createElement("div", { key: "out", className: "dsh-settings-row" }, React.createElement("div", { className: "dsh-settings-name-wrap" }, React.createElement("span", { className: "dsh-pool-dot " + poolDotClass("chatgpt") }), React.createElement("span", { className: "dsh-settings-name" }, t("chatgptAccount"))), React.createElement("button", { className: "dsh-settings-btn-secondary", type: "button", disabled: busy, onClick: startLogin }, t("chatgptLogin"))));
                extras.push(React.createElement("div", { key: "hint", className: "dsh-device-code-hint" }, t("chatgptLoginHint")));
                if (errorMsg) {
                    extras.push(React.createElement("div", { key: "err", className: "dsh-device-code-hint", style: { color: "var(--dsw-color-error,#F53F3F)" } }, t("chatgptLoginFailed", { msg: errorMsg })));
                }
            }
            return React.createElement("div", { className: "dsh-settings-section" }, React.createElement("div", { className: "dsh-settings-section-label" }, t("chatgptAccount")), children.length ? React.createElement("div", { className: "dsh-settings-list" }, children) : null, extras, React.createElement("div", { className: "dsh-settings-list", style: { marginTop: "8px" } }, React.createElement("div", { className: "dsh-settings-row" }, React.createElement("label", { className: "dsh-settings-name" }, t("chatgptProxy")), React.createElement("input", {
                className: "dsh-settings-input dsh-settings-proxy",
                type: "text",
                value: cgProxy,
                placeholder: t("chatgptProxyDirect"),
                onChange: function (e) { setProxy(e.target.value); }
            }))), React.createElement("div", { className: "dsh-device-code-hint" }, t("chatgptProxyHint")));
        }
        function SettingsPanel(props) {
            var specs = props.specs;
            var settings = props.settings;
            var onChange = props.onChange;
            var onReset = props.onReset;
            var onClose = props.onClose;
            var dragHandlers = props.dragHandlers;
            var headerDrag = props.headerDrag;
            var t = props.t;
            var call = props.call;
            var toggle = function (id) {
                var hidden = Object.assign({}, settings.hidden);
                if (hidden[id])
                    delete hidden[id];
                else
                    hidden[id] = true;
                onChange(Object.assign({}, settings, { hidden: hidden }));
            };
            var setRefresh = function (value) {
                var ms = value === "" ? null : Number(value);
                if (ms !== null && !(Number.isFinite(ms) && ms >= 5000))
                    ms = null;
                onChange(Object.assign({}, settings, { refreshMs: ms }));
            };
            var setWarn = function (id, text) {
                var warn = Object.assign({}, settings.warn);
                var n = Number(text);
                if (text === "" || !Number.isFinite(n) || n < 0)
                    delete warn[id];
                else
                    warn[id] = n;
                onChange(Object.assign({}, settings, { warn: warn }));
            };
            var setProxy = function (id, text) {
                var proxy = Object.assign({}, settings.proxy);
                var trimmed = text.trim();
                if (trimmed === "")
                    delete proxy[id];
                else
                    proxy[id] = trimmed;
                onChange(Object.assign({}, settings, { proxy: proxy }));
            };
            var setCapsule = function (value) {
                onChange(Object.assign({}, settings, { capsuleMode: CAPSULE_MODES[value] ? value : null }));
            };
            var resetPosition = function () {
                onChange(Object.assign({}, settings, { position: null }));
            };
            var setHolidays = function (text) {
                onChange(Object.assign({}, settings, { holidays: text }));
            };
            var sectionLabel = function (key) {
                return React.createElement("div", { className: "dsh-settings-section-label" }, t(key));
            };
            var holidaysSection = React.createElement("div", { key: "sec-holidays", className: "dsh-settings-section" }, sectionLabel("holidaysTitle"), React.createElement("div", { className: "dsh-settings-list" }, React.createElement("div", { className: "dsh-settings-row is-column" }, React.createElement("input", { className: "dsh-settings-input", type: "text", placeholder: "2026-10-01,2026-10-02", value: settings.holidays || "", onChange: function (e) { setHolidays(e.target.value); } }), React.createElement("div", { className: "dsh-settings-hint" }, t("holidaysHint")))));
            var refreshValue = "";
            if (settings.refreshMs !== null && settings.refreshMs !== undefined) {
                var match = REFRESH_CHOICES.some(function (choice) { return Number(choice.value) === settings.refreshMs; });
                refreshValue = match ? String(settings.refreshMs) : "";
            }
            var visibilityRows = specs.rows.map(function (spec) {
                var badgeText = spec.kind === "usage" ? t("badgeUsage") : (spec.kind === "balance" ? t("badgeBalance") : t("badgeInfo"));
                return React.createElement("div", { key: spec.id, className: "dsh-settings-row" }, React.createElement("div", { className: "dsh-settings-name-wrap" }, React.createElement("span", { className: "dsh-pool-dot " + poolDotClass(spec.id) }), React.createElement("span", { className: "dsh-settings-name", title: spec.label }, spec.label), React.createElement("span", { className: "dsh-settings-kind" }, badgeText)), React.createElement("label", { className: "dsh-settings-switch", title: spec.label }, React.createElement("input", {
                    type: "checkbox",
                    checked: !settings.hidden[spec.id],
                    onChange: function () { toggle(spec.id); }
                }), React.createElement("span", { className: "dsh-settings-switch-track" })));
            });
            var thresholdRows = specs.rows.map(function (spec) {
                if (spec.kind === "info")
                    return null;
                var isUsage = spec.kind === "usage";
                var placeholder = isUsage
                    ? t("warnPercentPH", { n: (spec.warnPercent || 70) })
                    : t("warnBalancePH", { cur: (spec.currency || "¥"), n: ((spec.balanceTiers && spec.balanceTiers.warn) || 20) });
                var raw = settings.warn[spec.id];
                return React.createElement("div", { key: spec.id, className: "dsh-settings-row" }, React.createElement("div", { className: "dsh-settings-name-wrap" }, React.createElement("span", { className: "dsh-pool-dot " + poolDotClass(spec.id) }), React.createElement("span", { className: "dsh-settings-name", title: spec.label }, spec.label), React.createElement("span", { className: "dsh-settings-kind" }, isUsage ? "%" : (spec.currency || "¥"))), React.createElement("input", {
                    className: "dsh-settings-input dsh-settings-number",
                    type: "number",
                    min: "0",
                    placeholder: placeholder,
                    value: raw === undefined || raw === null ? "" : String(raw),
                    onChange: function (event) { setWarn(spec.id, event.target.value); }
                }));
            });
            var proxyRows = specs.rows.map(function (spec) {
                var raw = settings.proxy && settings.proxy[spec.id] !== undefined ? String(settings.proxy[spec.id]) : "";
                var placeholder = spec.proxy
                    ? t("proxyConfigured", { name: spec.proxy })
                    : t("proxyDirect");
                return React.createElement("div", { key: spec.id, className: "dsh-settings-row" }, React.createElement("span", { className: "dsh-settings-name", title: spec.label }, spec.label), React.createElement("input", {
                    className: "dsh-settings-input dsh-settings-proxy",
                    type: "text",
                    placeholder: placeholder,
                    value: raw,
                    onChange: function (event) { setProxy(spec.id, event.target.value); }
                }));
            });
            // Mock board 03: the settings view renders as direct children of
            // #dsh-quota-card.is-settings — a nav row (title + close), then
            // List sections, then the footer actions row.
            return [
                React.createElement("div", Object.assign({}, dragHandlers, { onPointerDown: headerDrag, key: "nav", className: "dsh-settings-nav" }), React.createElement("span", { className: "dsh-settings-title" }, t("settingsTitle")), React.createElement("button", {
                    className: "dsh-quota-icon",
                    type: "button",
                    title: t("closeSettings"),
                    "aria-label": t("closeSettings"),
                    onClick: onClose
                }, ICON_CLOSE)),
                React.createElement("div", { key: "sec-providers", className: "dsh-settings-section" }, sectionLabel("settingsProviders"), visibilityRows.length ? React.createElement("div", { className: "dsh-settings-list" }, visibilityRows) : React.createElement("div", { className: "dsh-settings-hint" }, t("settingsNoProviders"))),
                holidaysSection,
                React.createElement("div", { key: "sec-refresh", className: "dsh-settings-section" }, sectionLabel("settingsInterval"), React.createElement("div", { className: "dsh-settings-list" }, React.createElement("div", { className: "dsh-settings-row" }, React.createElement("span", { className: "dsh-settings-name" }, t("settingsAutoRefresh")), React.createElement("select", {
                    className: "dsh-settings-select",
                    value: refreshValue,
                    onChange: function (event) { setRefresh(event.target.value); }
                }, REFRESH_CHOICES.map(function (choice) {
                    var label = choice.value === "" ? t("followConfig") + " (" + Math.round(specs.refreshMs / 1000) + "s)" : t("secondsSuffix", { n: Number(choice.value) / 1000 });
                    if (choice.value === "60000")
                        label = t("minutesSuffix", { n: 1 });
                    if (choice.value === "120000")
                        label = t("minutesSuffix", { n: 2 });
                    if (choice.value === "300000")
                        label = t("minutesSuffix", { n: 5 });
                    return React.createElement("option", { key: choice.value || "follow", value: choice.value }, label);
                }))), React.createElement("div", { className: "dsh-settings-row is-column" }, React.createElement("span", { className: "dsh-settings-name" }, t("capsuleName")), React.createElement("div", { className: "dsh-settings-radio-group", role: "radiogroup", "aria-label": t("capsuleName") }, CAPSULE_CHOICES.map(function (choice) {
                    var active = (settings.capsuleMode || "auto") === choice.value;
                    var shortKey = choice.value === "auto" ? "capsuleAutoShort"
                        : choice.value === "rolling" ? "capsuleRollingShort"
                            : choice.value === "weekly" ? "capsuleWeeklyShort"
                                : "capsuleMaxShort";
                    var fullKey = choice.value === "auto" ? "capsuleAuto"
                        : choice.value === "rolling" ? "capsuleRolling"
                            : choice.value === "weekly" ? "capsuleWeekly"
                                : "capsuleMax";
                    return React.createElement("label", { key: choice.value, className: "dsh-settings-radio", title: t(fullKey) }, React.createElement("input", {
                        type: "radio",
                        name: "dsh-capsule-mode",
                        checked: active,
                        onChange: function () { setCapsule(choice.value); }
                    }), React.createElement("span", { className: "dsh-settings-radio-box" }), t(shortKey));
                }))))),
                React.createElement("div", { key: "sec-thresholds", className: "dsh-settings-section" }, sectionLabel("settingsThresholds"), thresholdRows.filter(Boolean).length ? React.createElement("div", { className: "dsh-settings-list" }, thresholdRows) : null),
                React.createElement("div", { key: "sec-advanced", className: "dsh-settings-section" }, sectionLabel("settingsAdvanced"), React.createElement("div", { className: "dsh-settings-list" }, React.createElement("div", { className: "dsh-settings-row" }, React.createElement("span", { className: "dsh-settings-name" }, t("panelPosition")), React.createElement("button", {
                    className: "dsh-settings-btn-secondary",
                    type: "button",
                    onClick: resetPosition,
                    disabled: !settings.position
                }, settings.position ? t("resetPosition") : t("defaultPosition")))), React.createElement("div", { key: "sec-proxy", className: "dsh-settings-section" }, sectionLabel("settingsProxy"), React.createElement("div", { className: "dsh-settings-hint", style: { marginBottom: "4px" } }, t("proxyHint")), proxyRows.length ? React.createElement("div", { className: "dsh-settings-list" }, proxyRows) : null), React.createElement(ChatGPTAccount, { key: "chatgpt", t: t, call: call, settings: settings, onChange: onChange })),
                React.createElement("div", { key: "actions", className: "dsh-settings-actions" }, React.createElement("span", { className: "dsh-settings-hint" }, t("localOnly")), React.createElement("button", { className: "dsh-settings-btn-danger", type: "button", onClick: onReset }, t("resetDefaults")))
            ];
        }
        const inject = ["slots", "timer", "connection", "locale"];
        function apply(ctx) {
            // Standard cordis effect: setup runs now, the RETURNED function is the
            // disposer. (Do NOT invoke the callback here — passing the disposer to
            // ctx.effect would run tag.remove() immediately and strip the CSS,
            // leaving the widget unstyled in the overlay layer's top-left corner.)
            ctx.effect(function () {
                var tag = document.createElement("style");
                tag.dataset.plugin = "dsh-quota-panel";
                tag.textContent = CSS;
                document.head.append(tag);
                var lift = document.createElement("style");
                lift.dataset.plugin = "dsh-quota-panel";
                lift.dataset.role = "overlay-lift";
                lift.textContent = OVERLAY_LIFT_CSS;
                document.head.append(lift);
                return function () { tag.remove(); lift.remove(); };
            });
            function QuotaPanel(props) {
                var t = props.t;
                var specsState = React.useState(null);
                var specs = specsState[0], setSpecs = specsState[1];
                var dataState = React.useState({});
                var dataById = dataState[0], setDataById = dataState[1];
                var errState = React.useState(null);
                var loadError = errState[0], setLoadError = errState[1];
                var atState = React.useState(null);
                var fetchedAt = atState[0], setFetchedAt = atState[1];
                var expState = React.useState(false);
                var expanded = expState[0], setExpanded = expState[1];
                var setOpen = React.useState(false);
                var settingsOpen = setOpen[0], setSettingsOpen = setOpen[1];
                var refreshState = React.useState(false);
                var refreshing = refreshState[0], setRefreshing = refreshState[1];
                var settingsState = React.useState(readSettings);
                var settings = settingsState[0];
                var updateSettings = function (next) {
                    writeSettings(next);
                    settingsState[1](next);
                };
                // Draggable panel (issue #1 follow-up): the capsule and the
                // card header are drag handles. Below DRAG_THRESHOLD px of
                // travel the gesture stays a click (expand); beyond it the
                // panel follows the pointer, clamped so it stays grabbable,
                // and the position persists with the other settings. The
                // stored point is the panel's BOTTOM-RIGHT corner: the CSS
                // default (right/bottom 18px) anchors the same corner, and
                // expanding swaps sizes toward the top-left without moving
                // the anchor the user placed.
                var dragRef = React.useRef(null);
                var suppressClickRef = React.useRef(false);
                var dragPosState = React.useState(null);
                var dragPos = dragPosState[0], setDragPos = dragPosState[1];
                var panelPos = dragPos ?? settings.position ?? null;
                var panelStyle = panelPos ? { right: Math.max(0, Math.round(globalThis.innerWidth - panelPos.x)) + "px", bottom: Math.max(0, Math.round(globalThis.innerHeight - panelPos.y)) + "px" } : null;
                var startDrag = function (event) {
                    if (event.button !== undefined && event.button !== 0)
                        return;
                    var el = document.getElementById("dsh-quota-panel");
                    if (!el)
                        return;
                    try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }
                    catch (err) { }
                    var rect = el.getBoundingClientRect();
                    // Grab offsets measured from the BOTTOM-RIGHT corner: the
                    // corner keeps following the pointer at the same grab
                    // distance while sizes change underneath it.
                    dragRef.current = { id: event.pointerId, sx: event.clientX, sy: event.clientY, baseRight: rect.right, baseBottom: rect.bottom, anchorRight: rect.right - event.clientX, anchorBottom: rect.bottom - event.clientY, moved: false, pos: null };
                };
                var moveDrag = function (event) {
                    var d = dragRef.current;
                    if (!d || event.pointerId !== d.id)
                        return;
                    var dx = event.clientX - d.sx;
                    var dy = event.clientY - d.sy;
                    if (!d.moved) {
                        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD)
                            return;
                        d.moved = true;
                    }
                    d.pos = clampPos(d.baseRight + dx, d.baseBottom + dy, globalThis.innerWidth, globalThis.innerHeight);
                    setDragPos(d.pos);
                };
                var endDrag = function (event) {
                    var d = dragRef.current;
                    if (!d || (event && event.pointerId !== undefined && event.pointerId !== d.id))
                        return;
                    dragRef.current = null;
                    if (d.moved && d.pos) {
                        suppressClickRef.current = true;
                        updateSettings(Object.assign({}, settings, { position: d.pos }));
                        setDragPos(null);
                    }
                };
                var headerDrag = function (event) {
                    if (event.target && event.target.closest && event.target.closest("button"))
                        return;
                    startDrag(event);
                };
                var dragHandlers = {
                    onPointerDown: startDrag,
                    onPointerMove: moveDrag,
                    onPointerUp: endDrag,
                    onPointerLostPointerCapture: endDrag
                };
                // Re-clamp a restored position when the viewport shrinks
                // (window resized or a smaller screen) so the panel cannot
                // strand off-screen.
                React.useEffect(function () {
                    var reclamp = function () {
                        if (dragRef.current)
                            return;
                        var p = settings.position;
                        if (!p)
                            return;
                        var c = clampPos(p.x, p.y, globalThis.innerWidth, globalThis.innerHeight);
                        if (c.x !== p.x || c.y !== p.y)
                            updateSettings(Object.assign({}, settings, { position: c }));
                    };
                    reclamp();
                    globalThis.addEventListener("resize", reclamp);
                    return function () { globalThis.removeEventListener("resize", reclamp); };
                }, [panelPos ? panelPos.x + ":" + panelPos.y : ""]);
                var call = function (endpoint, payload) {
                    return ctx.connection.rpc.call(CHANNEL, RPC_METHOD_PREFIX + "/" + endpoint, payload);
                };
                var loadSpecs = function () {
                    return call("specs", null).then(function (result) {
                        if (result && result.ok === true && result.value && Array.isArray(result.value.rows)) {
                            setSpecs(result.value);
                        }
                        else {
                            setLoadError(result && result.error ? result.error.message : t("loadFailed"));
                        }
                    }).catch(function (error) {
                        setLoadError(String((error && error.message) || error));
                    });
                };
                var load = function () {
                    var proxyPayload = {};
                    if (settings.proxy && typeof settings.proxy === "object") {
                        for (var key in settings.proxy) {
                            var v = settings.proxy[key];
                            if (typeof v === "string" && v.trim() !== "")
                                proxyPayload[key] = v.trim();
                        }
                    }
                    return call("fetch-all", { proxy: proxyPayload }).then(function (result) {
                        if (result && result.ok === true && result.value && Array.isArray(result.value.rows)) {
                            var map = {};
                            for (var i = 0; i < result.value.rows.length; i++) {
                                var row = result.value.rows[i];
                                map[row.id] = row;
                            }
                            setDataById(map);
                            setFetchedAt(result.value.fetchedAt || Date.now());
                            setLoadError(null);
                        }
                        else {
                            setLoadError(result && result.error ? result.error.message : t("fetchFailed"));
                        }
                    }).catch(function (error) {
                        setLoadError(String((error && error.message) || error));
                    });
                };
                var refreshAll = function () {
                    if (refreshing)
                        return Promise.resolve();
                    setRefreshing(true);
                    // Specs reload every cycle: the row list is a one-shot probe of
                    // the host credential service, and a client that mounts before
                    // that service is fully warm captures a stale snapshot (new
                    // catalog rows skipped) that would otherwise never heal.
                    return loadSpecs().then(load).then(function () {
                        setRefreshing(false);
                    });
                };
                React.useEffect(function () {
                    loadSpecs().then(load);
                }, []);
                var effectiveMs = settings.refreshMs !== null && settings.refreshMs !== undefined
                    ? settings.refreshMs
                    : (specs ? specs.refreshMs : 60000);
                var proxyKey = JSON.stringify(settings.proxy || {});
                React.useEffect(function () {
                    return ctx.interval(function () {
                        if (!document.hidden)
                            loadSpecs().then(load);
                    }, effectiveMs);
                }, [effectiveMs, proxyKey]);
                // Opening the settings panel re-probes the row list too, so the
                // visibility checkboxes reflect the catalog immediately instead
                // of waiting for the next refresh interval.
                React.useEffect(function () {
                    if (settingsOpen)
                        loadSpecs();
                }, [settingsOpen]);
                React.useEffect(function () {
                    var onVisible = function () {
                        if (!document.hidden)
                            load();
                    };
                    document.addEventListener("visibilitychange", onVisible);
                    return function () { document.removeEventListener("visibilitychange", onVisible); };
                }, [proxyKey]);
                var rows = [];
                var views = {};
                if (specs) {
                    rows = specs.rows.filter(function (spec) { return !settings.hidden[spec.id]; });
                    for (var i = 0; i < specs.rows.length; i++) {
                        var spec = specs.rows[i];
                        views[spec.id] = rowView(t, spec, dataById[spec.id], settings.warn[spec.id], settings.capsuleMode);
                    }
                }
                if (!expanded) {
                    var ariaLabel = t("expand");
                    // Header health dot (design mock): any error row -> red, else
                    // any warn row -> orange, else green; the count is the number
                    // of visible providers.
                    var anyError = false;
                    var anyWarn = false;
                    for (var hi = 0; hi < rows.length; hi++) {
                        var hv = views[rows[hi].id];
                        if (!hv)
                            continue;
                        if (hv.status === "error")
                            anyError = true;
                        else if (hv.status === "warn")
                            anyWarn = true;
                    }
                    var pairs = [React.createElement("div", { key: "header", className: "dsh-capsule-header" }, React.createElement("span", { className: "dsh-capsule-title" }, t("title")), React.createElement("span", { className: "dsh-capsule-health" }, React.createElement("span", { className: "dsh-capsule-health-dot" + (anyError ? " is-error" : anyWarn ? " is-warn" : "") }), React.createElement("span", { className: "dsh-capsule-health-count" }, t("healthCount", { n: rows.length }))))];
                    if (specs === null && loadError !== null) {
                        pairs.push(React.createElement("div", { key: "sec-err", className: "dsh-capsule-section" }, React.createElement("span", { className: "dsh-capsule-status state-error" }, "—")));
                        ariaLabel = t("expand") + ": " + String(loadError);
                    }
                    else if (rows.length === 0) {
                        pairs.push(React.createElement("div", { key: "sec-none", className: "dsh-capsule-section" }, React.createElement("span", { className: "dsh-capsule-status" }, t("allHidden"))));
                        ariaLabel = t("allHidden") + " · " + t("expand");
                    }
                    else {
                        // Fixed id order (design spec): a stable glance beats a
                        // status-driven re-sort that jumps rows between refreshes.
                        var sortedRows = rows.slice().sort(function (a, b) {
                            var ia = FIXED_ORDER.indexOf(a.id);
                            if (ia < 0)
                                ia = FIXED_ORDER.length;
                            var ib = FIXED_ORDER.indexOf(b.id);
                            if (ib < 0)
                                ib = FIXED_ORDER.length;
                            return ia - ib;
                        });
                        // Two mock sections: usage pools on top, balance pools
                        // below the divider. An id outside both lists lands in the
                        // balance section and throws on the dot lookup — never
                        // silently dropped.
                        var usageKids = [];
                        var balanceKids = [];
                        for (var j = 0; j < sortedRows.length; j++) {
                            var rspec = sortedRows[j];
                            var itemEl = capsuleItem(rspec, views[rspec.id] || {}, settings.warn[rspec.id]);
                            if (USAGE_POOL_IDS[rspec.id])
                                usageKids.push(itemEl);
                            else
                                balanceKids.push(itemEl);
                        }
                        pairs.push(React.createElement("div", { key: "sec-usage", className: "dsh-capsule-section" }, React.createElement("div", { className: "dsh-capsule-section-label" }, t("poolUsage")), usageKids));
                        pairs.push(React.createElement("div", { key: "sec-balance", className: "dsh-capsule-section dsh-capsule-section-balance" }, React.createElement("div", { className: "dsh-capsule-section-label" }, t("poolBalance")), balanceKids));
                        var ariaParts = [];
                        for (var a = 0; a < rows.length; a++) {
                            var arspec = rows[a];
                            var aview = views[arspec.id];
                            var aname = arspec.label || arspec.short;
                            var asummary = aview ? aview.summary : "";
                            ariaParts.push(aname + " " + asummary);
                        }
                        ariaLabel = ariaParts.join("，") + " · " + t("expand");
                    }
                    return React.createElement("div", { id: "dsh-quota-panel", style: panelStyle }, React.createElement("button", Object.assign({}, dragHandlers, {
                        id: "dsh-quota-capsule",
                        type: "button",
                        "aria-label": ariaLabel,
                        "aria-expanded": "false",
                        onClick: function () {
                            if (suppressClickRef.current) {
                                suppressClickRef.current = false;
                                return;
                            }
                            setExpanded(true);
                        }
                    }), pairs));
                }
                var cardChildren = [];
                if (settingsOpen) {
                    // Mock board 03: the settings view replaces the card content
                    // entirely (nav + sections + actions, no standard header).
                    cardChildren = SettingsPanel({
                        key: "settings",
                        t: t,
                        call: call,
                        specs: specs,
                        settings: settings,
                        onChange: updateSettings,
                        onReset: function () { updateSettings({ hidden: {}, refreshMs: null, warn: {}, proxy: {}, capsuleMode: null, position: null }); },
                        onClose: function () { setSettingsOpen(false); },
                        dragHandlers: dragHandlers,
                        headerDrag: headerDrag
                    });
                }
                else {
                    var connectedTotal = rows.filter(function (r) {
                        var v = views[r.id];
                        return v && v.status !== "error";
                    }).length;
                    cardChildren.push(React.createElement("div", Object.assign({}, dragHandlers, { onPointerDown: headerDrag, key: "header", className: "dsh-quota-header" }), React.createElement("div", { className: "dsh-quota-header-left" }, React.createElement("span", { className: "dsh-quota-title" }, t("title")), React.createElement("span", { className: "dsh-quota-tag" }, t("connectedBadge", { n: connectedTotal }))), React.createElement("div", { className: "dsh-quota-actions" }, React.createElement("button", {
                        className: "dsh-quota-icon" + (refreshing ? " is-loading" : ""),
                        type: "button",
                        title: t("refresh"),
                        "aria-label": t("refresh"),
                        disabled: refreshing,
                        onClick: function () { refreshAll(); }
                    }, ICON_REFRESH), React.createElement("button", {
                        className: "dsh-quota-icon",
                        type: "button",
                        title: t("openSettings"),
                        "aria-label": t("openSettings"),
                        "aria-expanded": "false",
                        onClick: function () { setSettingsOpen(true); }
                    }, ICON_GEAR), React.createElement("button", {
                        className: "dsh-quota-icon",
                        type: "button",
                        title: t("collapse"),
                        "aria-label": t("collapse"),
                        onClick: function () { setExpanded(false); }
                    }, ICON_COLLAPSE))));
                    if (loadError !== null) {
                        cardChildren.push(React.createElement("div", { key: "err", className: "dsh-quota-error" }, String(loadError)));
                    }
                    else if (rows.length === 0) {
                        cardChildren.push(React.createElement("div", { key: "empty", className: "dsh-provider-sub" }, t("emptyHint")));
                    }
                    else {
                        // Grouped provider cards isolate themselves; no divider
                        // elements between rows any more.
                        for (var k = 0; k < rows.length; k++) {
                            cardChildren.push(React.createElement(ProviderRow, { key: rows[k].id, spec: rows[k], view: views[rows[k].id], t: t, holidays: settings.holidays, warn: settings.warn[rows[k].id] }));
                        }
                        cardChildren.push(React.createElement("div", { key: "footer", className: "dsh-quota-footer" }, React.createElement("span", null, (fetchedAt !== null ? t("updatedAt", { time: new Date(fetchedAt).toLocaleTimeString() }) + " · " : "")
                            + t("footerRefresh", { n: Math.round(effectiveMs / 1000) })), React.createElement("a", {
                            className: "dsh-quota-footer-link",
                            onClick: function () { setSettingsOpen(true); }
                        }, t("footerSettings"))));
                    }
                }
                return React.createElement("div", { id: "dsh-quota-panel", style: panelStyle }, React.createElement("div", { id: "dsh-quota-card", className: settingsOpen ? "is-settings" : "" }, cardChildren));
            }
            ctx.effect(function () {
                return ctx.locale.register(NS, DICT);
            }, "dsh-quota-panel: copy dictionaries");
            const t = ctx.locale.bind(NS);
            ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-quota-panel", order: 100, label: () => t("title"), locale: NS }, (props) => React.createElement(QuotaPanel, { t: props.t })));
        }
        exports.apply = apply;
        exports.inject = inject;
        return module.exports;
    }
});
