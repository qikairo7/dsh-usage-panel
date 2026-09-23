/**
 * dsh-quota-panel — client half (browser bundle, served at
 * /plugins/dsh-quota-panel/client.js through the `dsh.client` manifest).
 *
 * Registers one `shell.overlay` slot entry rendering the quota widget with
 * React: a collapsed glanceable capsule by default
 * (`● ¥58.36 · ● 45%`), expanding on click into the full card
 * (header "模型额度" + per-provider rows + progress bars). Next to the
 * refresh button, a gear button (⚙) opens the settings panel:
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
 * Styled with the Harness design tokens (`--dsw-alias-*`, `--dsw-static-*`,
 * `--dsw-shadow-*`, `--dsw-font-*`) with sensible fallbacks, so the widget
 * follows the product theme (light/dark) instead of carrying its own palette.
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
        var CSS = [
            '#dsh-quota-panel{position:fixed;right:18px;bottom:18px;z-index:900;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
            '#dsh-quota-capsule{width:384px;max-width:min(384px,calc(100vw - 36px));box-sizing:border-box;padding:16px 18px;display:flex;flex-direction:column;gap:8px;border:0.5px solid rgba(0,0,0,0.06);border-radius:24px;background:var(--dsw-apple-material-bg,rgba(255,255,255,0.72));backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);box-shadow:inset 0 0 0 0.5px var(--dsw-alias-border-specular,rgba(255,255,255,0.75)),0 16px 38px -4px rgba(0,0,0,0.08),0 4px 12px -2px rgba(0,0,0,0.04);cursor:pointer;outline:none;user-select:none;-webkit-user-select:none;touch-action:none;transform:translateY(0);transition:transform 0.12s cubic-bezier(0.2,0,0,1),background-color 0.2s cubic-bezier(0.25,1,0.5,1),box-shadow 0.2s cubic-bezier(0.25,1,0.5,1);animation:dsh-quota-capsule-enter 200ms cubic-bezier(0.16,1,0.3,1)}',
            '#dsh-quota-capsule:hover{background:rgba(255,255,255,0.82);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.88),0 20px 42px -4px rgba(0,0,0,0.10),0 6px 16px -2px rgba(0,0,0,0.05)}',
            '#dsh-quota-capsule:active{transform:scale(0.98);transition-duration:0.08s}',
            '#dsh-quota-capsule .dsh-capsule-item{padding:7px 12px;display:flex;flex-direction:column;gap:0;border-radius:14px;background:var(--dsw-apple-group-bg,rgba(255,255,255,0.55));box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.65),0 1px 2px rgba(0,0,0,0.02);position:relative;overflow:hidden;transition:background-color 0.15s ease}',
            '#dsh-quota-capsule .dsh-capsule-item:hover{background:var(--dsw-apple-group-hover,rgba(255,255,255,0.78))}',
            '#dsh-quota-capsule .dsh-capsule-group-title{font-size:13px;font-weight:590;letter-spacing:-0.2px;line-height:20px;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));margin-bottom:2px}',
            '#dsh-quota-capsule .dsh-capsule-main{min-height:26px;display:flex;align-items:center;gap:10px;position:relative}',
            '#dsh-quota-capsule .dsh-capsule-main + .dsh-capsule-main::before{content:\'\';position:absolute;top:0;left:12px;right:0;height:0.5px;background:var(--dsw-alias-border-l1,rgba(60,60,67,0.12))}',
            '#dsh-quota-capsule .dsh-capsule-main-sub{padding-left:12px}',
            '#dsh-quota-capsule .dsh-capsule-main-sub .dsh-capsule-label{flex:0 0 54px;min-width:54px;font-size:12px;font-weight:510;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60))}',
            '#dsh-quota-capsule .dsh-capsule-label{flex:0 0 136px;min-width:128px;font-size:13px;font-weight:590;letter-spacing:-0.2px;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}',
            '#dsh-quota-capsule .dsh-capsule-bar{flex:1;height:6px;border-radius:9999px;background:var(--dsw-apple-track-bg,rgba(120,120,128,0.16));overflow:hidden;display:flex;align-items:center}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill{height:100%;border-radius:inherit;background:var(--dsw-static-green-500,#34c759);transition:width 0.3s cubic-bezier(0.25,1,0.5,1),background-color 0.2s ease}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-ok{background:var(--dsw-static-green-500,#34c759)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-warn{background:var(--dsw-static-amber-500,#ff9500)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-error{background:var(--dsw-static-red-500,#ff3b30)}',
            '#dsh-quota-capsule .dsh-capsule-bar-fill.state-info{background:var(--dsw-static-deepseek-500,#007aff)}',
            '#dsh-quota-capsule .dsh-capsule-spacer{flex:1;height:1px}',
            '#dsh-quota-capsule .dsh-capsule-value{flex:0 0 92px;min-width:88px;text-align:right;font-size:12px;font-weight:590;letter-spacing:-0.15px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88))}',
            '#dsh-quota-capsule .dsh-capsule-value.state-loading{color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));font-weight:510}',
            '#dsh-quota-capsule .dsh-capsule-value.state-warn{color:var(--dsw-static-amber-500,#ff9500)}',
            '#dsh-quota-capsule .dsh-capsule-value.state-error{color:var(--dsw-static-red-500,#ff3b30)}',
            '#dsh-quota-capsule .dsh-capsule-detail{align-self:flex-start;margin-top:4px;display:inline-flex;align-items:center;gap:5px;padding:2.5px 8px;border-radius:9999px;background:var(--dsw-status-warn-bg,rgba(255,149,0,0.12));color:var(--dsw-status-warn-text,#ff9500);font-size:11px;font-weight:510;letter-spacing:-0.1px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
            '#dsh-quota-capsule .dsh-capsule-detail::before{content:\'\';width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}',
            '#dsh-quota-capsule .dsh-capsule-status{font-size:11.5px;font-weight:550;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));white-space:nowrap;text-align:center;width:100%}',
            '#dsh-quota-capsule .dsh-capsule-status.state-error{color:var(--dsw-static-red-500,#ff3b30)}',
            '#dsh-quota-card{width:440px;max-width:min(440px,calc(100vw - 36px));max-height:min(840px,calc(100vh - 36px));box-sizing:border-box;padding:16px 18px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overscroll-behavior:contain;border:0.5px solid rgba(0,0,0,0.06);border-radius:24px;background:var(--dsw-apple-material-bg,rgba(255,255,255,0.72));backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);box-shadow:inset 0 0 0 0.5px var(--dsw-alias-border-specular,rgba(255,255,255,0.75)),0 16px 38px -4px rgba(0,0,0,0.08),0 4px 12px -2px rgba(0,0,0,0.04);transform-origin:bottom right;animation:dsh-quota-card-enter 220ms cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:rgba(60,60,67,0.18) transparent}',
            '#dsh-quota-card::-webkit-scrollbar{width:4px}',
            '#dsh-quota-card::-webkit-scrollbar-thumb{background:rgba(60,60,67,0.2);border-radius:9999px}',
            '#dsh-quota-card .dsh-quota-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:4px;cursor:grab;user-select:none;touch-action:none}',
            '#dsh-quota-card .dsh-quota-header-left{display:flex;align-items:center;gap:8px;min-width:0}',
            '#dsh-quota-card .dsh-quota-title{font-size:15px;font-weight:650;letter-spacing:-0.3px;color:#1d1d1f}',
            '#dsh-quota-card .dsh-quota-header-badge{font-size:10.5px;font-weight:590;padding:1px 7px;border-radius:9999px;background:rgba(0,0,0,0.05);color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));white-space:nowrap}',
            '#dsh-quota-card .dsh-quota-actions{display:flex;align-items:center;gap:6px}',
            '#dsh-quota-card .dsh-quota-icon{width:28px;height:28px;display:inline-grid;place-items:center;padding:0;border:0.5px solid rgba(0,0,0,0.04);border-radius:50%;background:rgba(0,0,0,0.04);color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));font-size:13px;line-height:1;cursor:pointer;outline:none;transition:background-color 0.15s ease,transform 0.1s ease,color 0.15s ease}',
            '#dsh-quota-card .dsh-quota-icon:hover{background:rgba(0,0,0,0.08);color:#1d1d1f}',
            '#dsh-quota-card .dsh-quota-icon:active{transform:scale(0.92)}',
            '#dsh-quota-card .dsh-quota-icon:disabled{cursor:default;opacity:0.4;transform:none}',
            '#dsh-quota-card .dsh-quota-icon.is-loading{animation:dsh-quota-spin 0.75s cubic-bezier(0.4,0,0.2,1) infinite}',
            '#dsh-quota-card .dsh-quota-icon.is-active{background:rgba(0,122,255,0.15);color:var(--dsw-static-deepseek-500,#007aff)}',
            '@keyframes dsh-quota-spin{to{transform:rotate(360deg)}}',
            '@keyframes dsh-quota-card-enter{from{opacity:0;transform:scale(0.96) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}',
            '@keyframes dsh-quota-capsule-enter{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}',
            '#dsh-quota-card .dsh-provider{padding:10px 14px;display:flex;flex-direction:column;gap:6px;border-radius:14px;background:var(--dsw-apple-group-bg,rgba(255,255,255,0.55));box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.65),0 1px 2px rgba(0,0,0,0.02);position:relative;overflow:hidden}',
            '#dsh-quota-card .dsh-provider-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:22px}',
            '#dsh-quota-card .dsh-provider-meta{display:flex;align-items:center;gap:8px;min-width:0}',
            '#dsh-quota-card .dsh-status-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-static-green-500,#34c759);box-shadow:0 0 0 2px rgba(52,199,89,0.2)}',
            '#dsh-quota-card .state-loading .dsh-status-dot{background:#adb2b8;box-shadow:0 0 0 2px rgba(173,178,184,0.15)}',
            '#dsh-quota-card .dsh-provider.state-warn .dsh-status-dot{background:var(--dsw-static-amber-500,#ff9500);box-shadow:0 0 0 2px rgba(255,149,0,0.25)}',
            '#dsh-quota-card .dsh-provider.state-error .dsh-status-dot{background:var(--dsw-static-red-500,#ff3b30);box-shadow:0 0 0 2px rgba(255,59,48,0.25)}',
            '#dsh-quota-card .dsh-provider.state-info .dsh-status-dot{background:var(--dsw-static-deepseek-500,#007aff);box-shadow:0 0 0 2px rgba(0,122,255,0.2)}',
            '#dsh-quota-card .dsh-provider-name{font-size:13px;font-weight:590;letter-spacing:-0.2px;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '#dsh-quota-card .dsh-peak-badge{display:inline-flex;align-items:center;flex:none;font-size:10px;line-height:14px;font-weight:510;padding:1px 6px;border-radius:9999px;letter-spacing:0}',
            '#dsh-quota-card .dsh-peak-badge.state-peak{background:var(--dsw-status-warn-bg,rgba(255,149,0,0.12));color:var(--dsw-status-warn-text,#ff9500)}',
            '#dsh-quota-card .dsh-peak-badge.state-off{background:var(--dsw-status-success-bg,rgba(52,199,89,0.12));color:var(--dsw-status-success-text,#34c759)}',
            '#dsh-quota-card .dsh-provider-value{flex:none;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-0.2px;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88))}',
            '#dsh-quota-card .dsh-provider.state-warn .dsh-provider-value{color:var(--dsw-static-amber-500,#ff9500)}',
            '#dsh-quota-card .dsh-provider.state-error .dsh-provider-value{color:var(--dsw-static-red-500,#ff3b30)}',
            '#dsh-quota-card .dsh-window-item{display:flex;flex-direction:column;gap:4px;padding-top:4px;position:relative}',
            '#dsh-quota-card .dsh-window-item + .dsh-window-item{margin-top:4px;padding-top:6px;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(60,60,67,0.12))}',
            '#dsh-quota-card .dsh-usage-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));font-variant-numeric:tabular-nums}',
            '#dsh-quota-card .dsh-progress{width:100%;height:6px;border-radius:9999px;background:var(--dsw-apple-track-bg,rgba(120,120,128,0.16));overflow:hidden}',
            '#dsh-quota-card .dsh-progress-fill{height:100%;width:0;border-radius:inherit;background:var(--dsw-static-deepseek-500,#007aff);transition:width 0.3s cubic-bezier(0.25,1,0.5,1)}',
            '#dsh-quota-card .dsh-progress-fill.state-warn{background:var(--dsw-static-amber-500,#ff9500)}',
            '#dsh-quota-card .dsh-progress-fill.state-error{background:var(--dsw-static-red-500,#ff3b30)}',
            '#dsh-quota-card .dsh-usage-caption{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,rgba(60,60,67,0.38))}',
            '#dsh-quota-card .dsh-provider-sub{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60))}',
            '#dsh-quota-card .dsh-rate-limit-card{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border-radius:8px;background:var(--dsw-status-warn-bg,rgba(255,149,0,0.12));color:var(--dsw-status-warn-text,#ff9500);font-size:11px;font-weight:510;margin-top:2px}',
            '#dsh-quota-card .dsh-rate-limit-badge{display:inline-flex;align-items:center;gap:4px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis}',
            '#dsh-quota-card .dsh-rate-limit-timer{font-variant-numeric:tabular-nums;font-weight:600;flex:none}',
            '#dsh-quota-card .dsh-quota-error{color:var(--dsw-static-red-500,#ff3b30);font-size:12px;line-height:17px;word-break:break-all}',
            '#dsh-quota-card .dsh-quota-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px 2px;margin-top:2px;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(60,60,67,0.12));font-size:11px;color:var(--dsw-alias-label-tertiary,rgba(60,60,67,0.38))}',
            '#dsh-quota-card .dsh-quota-footer-link{color:var(--dsw-static-deepseek-500,#007aff);cursor:pointer;text-decoration:none;font-weight:510;display:inline-flex;align-items:center;gap:3px}',
            '#dsh-quota-card .dsh-quota-footer-link:hover{text-decoration:underline}',
            '#dsh-quota-panel .dsh-quota-settings{display:flex;flex-direction:column;gap:16px;max-height:min(760px,calc(100vh - 120px));overflow-y:auto;overflow-x:hidden;padding-right:2px;animation:dsh-quota-settings-fade 180ms cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:rgba(60,60,67,0.18) transparent}',
            '#dsh-quota-panel .dsh-quota-settings::-webkit-scrollbar{width:4px}',
            '#dsh-quota-panel .dsh-quota-settings::-webkit-scrollbar-thumb{background:rgba(60,60,67,0.2);border-radius:9999px}',
            '@keyframes dsh-quota-settings-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
            '#dsh-quota-panel .dsh-setting-section{display:flex;flex-direction:column;gap:6px}',
            '#dsh-quota-panel .dsh-setting-title{font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));padding-left:6px}',
            '#dsh-quota-panel .dsh-setting-group{background:var(--dsw-apple-group-bg,rgba(255,255,255,0.55));border-radius:14px;box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.65),0 1px 2px rgba(0,0,0,0.02);position:relative;overflow:hidden}',
            '#dsh-quota-panel .dsh-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:38px;padding:8px 12px;font-size:13px;color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));position:relative}',
            '#dsh-quota-panel .dsh-setting-row + .dsh-setting-row::before{content:\'\';position:absolute;top:0;left:12px;right:0;height:0.5px;background:var(--dsw-alias-border-l1,rgba(60,60,67,0.12))}',
            '#dsh-quota-panel .dsh-setting-name-wrap{display:flex;align-items:center;gap:8px;min-width:0;flex:1}',
            '#dsh-quota-panel .dsh-setting-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:510}',
            '#dsh-quota-panel .dsh-setting-badge{font-size:10px;font-weight:590;line-height:14px;padding:1px 6px;border-radius:4px;flex:none}',
            '#dsh-quota-panel .dsh-setting-badge-usage{background:var(--dsw-status-info-bg,rgba(0,122,255,0.10));color:var(--dsw-status-info-text,#007aff)}',
            '#dsh-quota-panel .dsh-setting-badge-balance{background:var(--dsw-status-success-bg,rgba(52,199,89,0.12));color:var(--dsw-status-success-text,#34c759)}',
            '#dsh-quota-panel .dsh-setting-badge-info{background:rgba(0,0,0,0.05);color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60))}',
            '#dsh-quota-panel .dsh-setting-toggle{position:relative;display:inline-flex;align-items:center;cursor:pointer;user-select:none;flex:none}',
            '#dsh-quota-panel .dsh-setting-toggle-input{position:absolute;opacity:0;width:0;height:0;margin:0;pointer-events:none}',
            '#dsh-quota-panel .dsh-setting-toggle-track{display:block;width:38px;height:22px;border-radius:9999px;background:rgba(120,120,128,0.22);position:relative;transition:background-color 0.25s cubic-bezier(0.25,1,0.5,1)}',
            '#dsh-quota-panel .dsh-setting-toggle-thumb{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#ffffff;box-shadow:0 2px 4px rgba(0,0,0,0.18),0 0.5px 1px rgba(0,0,0,0.08);transition:transform 0.25s cubic-bezier(0.25,1,0.5,1),width 0.15s ease}',
            '#dsh-quota-panel .dsh-setting-toggle-input:checked + .dsh-setting-toggle-track{background:var(--dsw-static-green-500,#34c759)}',
            '#dsh-quota-panel .dsh-setting-toggle-input:checked + .dsh-setting-toggle-track .dsh-setting-toggle-thumb{transform:translateX(16px)}',
            '#dsh-quota-panel .dsh-setting-toggle:active .dsh-setting-toggle-thumb{width:21px}',
            '#dsh-quota-panel .dsh-setting-toggle-input:focus-visible + .dsh-setting-toggle-track{box-shadow:0 0 0 2px rgba(0,122,255,0.35)}',
            '#dsh-quota-panel .dsh-setting-segmented{display:flex;align-items:center;width:100%;padding:2.5px;border-radius:9px;background:var(--dsw-apple-seg-bg,rgba(120,120,128,0.12));gap:2px}',
            '#dsh-quota-panel .dsh-setting-seg-btn{flex:1;padding:5px 2px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,rgba(60,60,67,0.60));font:inherit;font-size:11.5px;font-weight:510;line-height:16px;text-align:center;cursor:pointer;outline:none;white-space:nowrap;user-select:none;transition:background-color 0.18s ease,color 0.15s ease,box-shadow 0.18s ease}',
            '#dsh-quota-panel .dsh-setting-seg-btn:hover{color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88))}',
            '#dsh-quota-panel .dsh-setting-seg-btn.is-active{background:#ffffff;color:#1d1d1f;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,0.10),0 0.5px 1px rgba(0,0,0,0.06)}',
            '#dsh-quota-panel .dsh-setting-seg-btn:focus-visible{box-shadow:0 0 0 2px rgba(0,122,255,0.35)}',
            '#dsh-quota-panel .dsh-setting-input,#dsh-quota-panel .dsh-setting-select{padding:5px 9px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.10);background:rgba(255,255,255,0.85);color:var(--dsw-alias-label-primary,rgba(0,0,0,0.88));font:inherit;font-size:12px;line-height:16px;outline:none;transition:border-color 0.15s ease,box-shadow 0.15s ease}',
            '#dsh-quota-panel .dsh-setting-input:focus,#dsh-quota-panel .dsh-setting-select:focus{border-color:var(--dsw-static-deepseek-500,#007aff);box-shadow:0 0 0 2.5px rgba(0,122,255,0.18)}',
            '#dsh-quota-panel .dsh-setting-number{width:96px;text-align:right;font-variant-numeric:tabular-nums}',
            '#dsh-quota-panel .dsh-setting-proxy{width:164px;font-size:11.5px}',
            '#dsh-quota-panel .dsh-setting-reset{padding:5px 12px;border-radius:8px;border:none;background:var(--dsw-status-info-bg,rgba(0,122,255,0.10));color:var(--dsw-static-deepseek-500,#007aff);font:inherit;font-size:12px;font-weight:590;cursor:pointer;outline:none;transition:background-color 0.15s ease,transform 0.1s ease,opacity 0.15s ease}',
            '#dsh-quota-panel .dsh-setting-reset:hover{background:rgba(0,122,255,0.16)}',
            '#dsh-quota-panel .dsh-setting-reset:active{transform:scale(0.96)}',
            '#dsh-quota-panel .dsh-setting-reset:disabled{opacity:0.4;cursor:default;transform:none}',
            '#dsh-quota-panel .dsh-setting-sub-section{margin-top:10px;padding-top:10px;border-top:0.5px dashed var(--dsw-alias-border-l1,rgba(60,60,67,0.12))}',
            '#dsh-quota-panel .dsh-setting-hint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,rgba(60,60,67,0.38));padding:2px 6px}',
            '#dsh-quota-panel .dsh-setting-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px 0;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(60,60,67,0.12))}',
            '#dsh-quota-panel .dsh-chatgpt-url a{color:var(--dsw-static-deepseek-500,#007aff);font-size:11px;word-break:break-all;text-decoration:none}',
            '#dsh-quota-panel .dsh-chatgpt-url a:hover{text-decoration:underline}',
            '#dsh-quota-panel .dsh-chatgpt-code-box{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:9px;background:rgba(0,0,0,0.03);border:0.5px solid rgba(0,0,0,0.06)}',
            '#dsh-quota-panel .dsh-chatgpt-code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:16px;font-weight:700;letter-spacing:2px;color:#1d1d1f}',
            '@media (prefers-reduced-motion: reduce){#dsh-quota-capsule{animation:none;transition:none}#dsh-quota-capsule:active{transform:none}#dsh-quota-capsule .dsh-capsule-item{transition:none}#dsh-quota-capsule .dsh-capsule-bar-fill{transition:none}#dsh-quota-card{animation:none;transition:none}#dsh-quota-card .dsh-progress-fill{transition:none}#dsh-quota-card .dsh-quota-icon{transition:none}#dsh-quota-panel .dsh-quota-settings{animation:none}#dsh-quota-panel .dsh-setting-toggle-track{transition:none}#dsh-quota-panel .dsh-setting-toggle-thumb{transition:none}#dsh-quota-panel .dsh-setting-toggle:active .dsh-setting-toggle-thumb{width:18px}#dsh-quota-panel .dsh-setting-seg-btn{transition:none}#dsh-quota-panel .dsh-setting-reset{transition:none}}'
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
        function ProviderRow(props) {
            var spec = props.spec;
            var view = props.view;
            var t = props.t;
            var meta = [
                React.createElement("span", { key: "dot", className: "dsh-status-dot" }),
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
                    var itemKids = [React.createElement("div", { key: "row", className: "dsh-usage-row" }, React.createElement("span", null, winFullLabel(wrow.label) + " · " + (wrow.percent === null ? "—" : wrow.percent + "%")), wrow.resetsAt ? React.createElement("span", null, t("nextReset", { time: fmtShortReset(wrow.resetsAt) || fmtNextReset(t, wrow.resetsAt) })) : null)];
                    itemKids.push(React.createElement("div", { key: "track", className: "dsh-progress" }, React.createElement("div", { className: "dsh-progress-fill state-" + wst, style: { width: wpct + "%" } })));
                    body.push(React.createElement("div", { key: "w" + wi, className: "dsh-window-item" }, itemKids));
                }
                if (view.caption)
                    body.push(React.createElement("div", { key: "cap", className: "dsh-usage-caption" }, view.caption));
            }
            else if (view.rateLimited && view.sub) {
                // Soft-rate (429) window: an amber card beats the plain sub line.
                body.push(React.createElement("div", { key: "rate", className: "dsh-rate-limit-card" }, React.createElement("span", { className: "dsh-rate-limit-badge" }, view.sub)));
            }
            else if (view.sub) {
                body.push(React.createElement("div", { key: "sub", className: "dsh-provider-sub" }, view.sub));
            }
            return React.createElement("div", { className: "dsh-provider state-" + view.status, title: view.title }, body);
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
            if (status && status.loggedIn && !(login && login.active)) {
                children.push(React.createElement("div", { key: "in", className: "dsh-setting-hint" }, t("chatgptLoggedIn", { source: sourceLabel(status.source) })
                    + (status.plan_type ? " · " + t("chatgptPlan", { plan: status.plan_type }) : "")));
                children.push(React.createElement("button", {
                    key: "out", className: "dsh-setting-reset", type: "button", onClick: logout
                }, t("chatgptLogout")));
            }
            else if (inFlight && login && login.userCode) {
                children.push(React.createElement("div", { key: "s1", className: "dsh-setting-hint" }, t("chatgptLoginStep1")));
                children.push(React.createElement("div", { key: "url", className: "dsh-chatgpt-url" }, React.createElement("a", { href: login.verificationUrl, target: "_blank", rel: "noreferrer" }, login.verificationUrl)));
                children.push(React.createElement("div", { key: "s2", className: "dsh-setting-hint", style: { marginTop: "6px" } }, t("chatgptLoginStep2")));
                children.push(React.createElement("div", { key: "code", className: "dsh-chatgpt-code-box" }, React.createElement("span", { className: "dsh-chatgpt-code" }, login.userCode), React.createElement("button", {
                    className: "dsh-setting-reset", type: "button", onClick: function () { copyCode(login.userCode); }
                }, copied ? t("chatgptCopied") : t("chatgptCopy"))));
                children.push(React.createElement("div", { key: "wait", className: "dsh-setting-hint", style: { marginTop: "6px" } }, t("chatgptWaiting")));
                children.push(React.createElement("button", {
                    key: "cancel", className: "dsh-setting-reset", type: "button", style: { marginTop: "6px" }, onClick: cancelLogin
                }, t("chatgptCancel")));
            }
            else {
                children.push(React.createElement("div", { key: "hint", className: "dsh-setting-hint" }, t("chatgptLoginHint")));
                if (errorMsg) {
                    children.push(React.createElement("div", { key: "err", className: "dsh-setting-hint", style: { color: "#e5484d" } }, t("chatgptLoginFailed", { msg: errorMsg })));
                }
                children.push(React.createElement("button", {
                    key: "in", className: "dsh-setting-reset", type: "button", disabled: busy, onClick: startLogin
                }, t("chatgptLogin")));
            }
            return React.createElement("div", { className: "dsh-setting-sub-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("chatgptAccount")), React.createElement("div", { className: "dsh-setting-row dsh-chatgpt-row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } }, children), React.createElement("div", { className: "dsh-setting-row dsh-setting-row-interactive", style: { marginTop: "4px" } }, React.createElement("label", { className: "dsh-setting-name" }, t("chatgptProxy")), React.createElement("input", {
                className: "dsh-setting-input dsh-setting-proxy",
                type: "text",
                value: cgProxy,
                placeholder: t("chatgptProxyDirect"),
                onChange: function (e) { setProxy(e.target.value); }
            })), React.createElement("div", { className: "dsh-setting-hint" }, t("chatgptProxyHint")));
        }
        function SettingsPanel(props) {
            var specs = props.specs;
            var settings = props.settings;
            var onChange = props.onChange;
            var onReset = props.onReset;
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
            var holidaysSection = React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("holidaysTitle")), React.createElement("div", { className: "dsh-setting-group" }, React.createElement("div", { className: "dsh-setting-row dsh-setting-row-interactive", style: { flexDirection: "column", alignItems: "stretch", gap: "4px" } }, React.createElement("input", { className: "dsh-setting-input", type: "text", placeholder: "2026-10-01,2026-10-02", value: settings.holidays || "", onChange: function (e) { setHolidays(e.target.value); } }), React.createElement("div", { className: "dsh-setting-hint" }, t("holidaysHint")))));
            var refreshValue = "";
            if (settings.refreshMs !== null && settings.refreshMs !== undefined) {
                var match = REFRESH_CHOICES.some(function (choice) { return Number(choice.value) === settings.refreshMs; });
                refreshValue = match ? String(settings.refreshMs) : "";
            }
            var visibilityRows = specs.rows.map(function (spec) {
                var badgeText = spec.kind === "usage" ? t("badgeUsage") : (spec.kind === "balance" ? t("badgeBalance") : t("badgeInfo"));
                return React.createElement("div", { key: spec.id, className: "dsh-setting-row dsh-setting-row-interactive" }, React.createElement("div", { className: "dsh-setting-name-wrap" }, React.createElement("span", { className: "dsh-setting-name", title: spec.label }, spec.label), React.createElement("span", { className: "dsh-setting-badge dsh-setting-badge-" + spec.kind }, badgeText)), React.createElement("label", { className: "dsh-setting-toggle", title: spec.label }, React.createElement("input", {
                    className: "dsh-setting-toggle-input",
                    type: "checkbox",
                    checked: !settings.hidden[spec.id],
                    onChange: function () { toggle(spec.id); }
                }), React.createElement("span", { className: "dsh-setting-toggle-track" }, React.createElement("span", { className: "dsh-setting-toggle-thumb" }))));
            });
            var thresholdRows = specs.rows.map(function (spec) {
                if (spec.kind === "info")
                    return null;
                var isUsage = spec.kind === "usage";
                var placeholder = isUsage
                    ? t("warnPercentPH", { n: (spec.warnPercent || 70) })
                    : t("warnBalancePH", { cur: (spec.currency || "¥"), n: ((spec.balanceTiers && spec.balanceTiers.warn) || 20) });
                var raw = settings.warn[spec.id];
                return React.createElement("div", { key: spec.id, className: "dsh-setting-row dsh-setting-row-interactive" }, React.createElement("div", { className: "dsh-setting-name-wrap" }, React.createElement("span", { className: "dsh-setting-name", title: spec.label }, spec.label), React.createElement("span", { className: "dsh-setting-badge dsh-setting-badge-" + spec.kind }, isUsage ? "%" : (spec.currency || "¥"))), React.createElement("input", {
                    className: "dsh-setting-input dsh-setting-number",
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
                return React.createElement("div", { key: spec.id, className: "dsh-setting-row dsh-setting-row-interactive" }, React.createElement("span", { className: "dsh-setting-name", title: spec.label }, spec.label), React.createElement("input", {
                    className: "dsh-setting-input dsh-setting-proxy",
                    type: "text",
                    placeholder: placeholder,
                    value: raw,
                    onChange: function (event) { setProxy(spec.id, event.target.value); }
                }));
            });
            return React.createElement("div", { className: "dsh-quota-settings" }, React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsProviders")), visibilityRows.length ? React.createElement("div", { className: "dsh-setting-group" }, visibilityRows) : React.createElement("div", { className: "dsh-setting-hint" }, t("settingsNoProviders"))), holidaysSection, React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsInterval")), React.createElement("div", { className: "dsh-setting-group" }, React.createElement("div", { className: "dsh-setting-row" }, React.createElement("span", { className: "dsh-setting-name" }, t("settingsAutoRefresh")), React.createElement("select", {
                className: "dsh-setting-select",
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
            }))), React.createElement("div", { className: "dsh-setting-row", style: { flexDirection: "column", alignItems: "stretch", gap: "8px" } }, React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } }, React.createElement("span", { className: "dsh-setting-name" }, t("capsuleName")), React.createElement("span", { className: "dsh-setting-hint", style: { padding: "0" } }, (settings.capsuleMode || "auto") === "auto" ? t("capsuleAuto") : (settings.capsuleMode === "rolling" ? t("capsuleRolling") : (settings.capsuleMode === "weekly" ? t("capsuleWeekly") : t("capsuleMax"))))), React.createElement("div", { className: "dsh-setting-segmented", role: "radiogroup", "aria-label": t("capsuleName") }, CAPSULE_CHOICES.map(function (choice) {
                var active = (settings.capsuleMode || "auto") === choice.value;
                var shortKey = choice.value === "auto" ? "capsuleAutoShort"
                    : choice.value === "rolling" ? "capsuleRollingShort"
                        : choice.value === "weekly" ? "capsuleWeeklyShort"
                            : "capsuleMaxShort";
                var fullKey = choice.value === "auto" ? "capsuleAuto"
                    : choice.value === "rolling" ? "capsuleRolling"
                        : choice.value === "weekly" ? "capsuleWeekly"
                            : "capsuleMax";
                return React.createElement("button", {
                    key: choice.value,
                    type: "button",
                    role: "radio",
                    "aria-checked": active ? "true" : "false",
                    title: t(fullKey),
                    className: "dsh-setting-seg-btn" + (active ? " is-active" : ""),
                    onClick: function () { setCapsule(choice.value); }
                }, t(shortKey));
            }))))), React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsThresholds")), thresholdRows.filter(Boolean).length ? React.createElement("div", { className: "dsh-setting-group" }, thresholdRows) : null), React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsAdvanced")), React.createElement("div", { className: "dsh-setting-group" }, React.createElement("div", { className: "dsh-setting-row dsh-setting-row-interactive" }, React.createElement("span", { className: "dsh-setting-name" }, t("panelPosition")), React.createElement("button", {
                className: "dsh-setting-reset",
                type: "button",
                onClick: resetPosition,
                disabled: !settings.position
            }, settings.position ? t("resetPosition") : t("defaultPosition")))), React.createElement("div", { className: "dsh-setting-sub-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsProxy")), React.createElement("div", { className: "dsh-setting-hint", style: { marginBottom: "4px" } }, t("proxyHint")), proxyRows.length ? React.createElement("div", { className: "dsh-setting-group" }, proxyRows) : null), React.createElement(ChatGPTAccount, { key: "chatgpt", t: t, call: call, settings: settings, onChange: onChange })), React.createElement("div", { className: "dsh-setting-actions" }, React.createElement("span", { className: "dsh-setting-hint" }, t("localOnly")), React.createElement("button", { className: "dsh-setting-reset", type: "button", onClick: onReset }, t("resetDefaults"))));
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
                    var pairs = [];
                    var ariaLabel = t("expand");
                    if (specs === null && loadError !== null) {
                        pairs.push(React.createElement("span", { key: "err", className: "dsh-capsule-status state-error" }, "—"));
                        ariaLabel = t("expand") + ": " + String(loadError);
                    }
                    else if (rows.length === 0) {
                        pairs.push(React.createElement("span", { key: "none", className: "dsh-capsule-status state-loading" }, t("allHidden")));
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
                        for (var j = 0; j < sortedRows.length; j++) {
                            var rspec = sortedRows[j];
                            var rview = views[rspec.id] || {};
                            var pct = typeof rview.barPercent === "number" && Number.isFinite(rview.barPercent)
                                ? Math.min(Math.max(rview.barPercent, 0), 100)
                                : 0;
                            var renderCapsuleRow = function (rowKey, rowName, rowPct, rowStatus, rowValue, isSub) {
                                var kids = [
                                    React.createElement("span", {
                                        key: "name",
                                        className: "dsh-capsule-label",
                                        title: isSub ? rowName : rspec.label
                                    }, rowName)
                                ];
                                if (rowPct !== null) {
                                    kids.push(React.createElement("span", { key: "bar", className: "dsh-capsule-bar" }, React.createElement("span", {
                                        className: "dsh-capsule-bar-fill state-" + (rowStatus || "ok"),
                                        style: { width: Math.min(Math.max(rowPct, 0), 100) + "%" }
                                    })));
                                }
                                else {
                                    kids.push(React.createElement("span", { key: "spacer", className: "dsh-capsule-spacer" }));
                                }
                                kids.push(React.createElement("span", {
                                    key: "value",
                                    className: "dsh-capsule-value state-" + (rowStatus || "ok")
                                }, rowValue));
                                return React.createElement("div", {
                                    key: rspec.id + "-" + rowKey,
                                    className: "dsh-capsule-main" + (isSub ? " dsh-capsule-main-sub" : "")
                                }, kids);
                            };
                            // Grouped card (design spec): a usage provider with
                            // several carried windows gets a group-title header
                            // plus one indented row per window, each labelled
                            // with the FULL window name (5小时额度 / 周额度 /
                            // 月额度); single-window usage keeps one full-name
                            // row with its reset time inline.
                            var itemRows = [];
                            var winList = rview.kind === "usage" && Array.isArray(rview.windowsList) ? rview.windowsList : [];
                            if (winList.length > 1) {
                                var warnPct = typeof settings.warn[rspec.id] === "number" && Number.isFinite(settings.warn[rspec.id]) && settings.warn[rspec.id] >= 0 ? settings.warn[rspec.id] : (rspec.warnPercent || 70);
                                var errPct = Math.max(rspec.errorPercent || 90, warnPct + 1);
                                itemRows.push(React.createElement("div", {
                                    key: rspec.id + "-gtitle",
                                    className: "dsh-capsule-group-title"
                                }, rspec.label));
                                for (var wi = 0; wi < winList.length; wi++) {
                                    var wrow = winList[wi];
                                    var wst = wrow.percent >= errPct ? "error" : wrow.percent >= warnPct ? "warn" : "ok";
                                    var wshort = wrow.resetsAt ? fmtShortReset(wrow.resetsAt) : "";
                                    itemRows.push(renderCapsuleRow("w" + wi, winFullLabel(wrow.label), wrow.percent, wst, (wrow.percent === null ? "—" : wrow.percent + "%") + (wshort ? " (" + wshort + ")" : ""), true));
                                }
                            }
                            else if (winList.length === 1) {
                                var s0 = winList[0];
                                var sshort = s0.resetsAt ? fmtShortReset(s0.resetsAt) : "";
                                itemRows.push(renderCapsuleRow("main", rspec.label, s0.percent, rview.status, (s0.percent === null ? "—" : s0.percent + "%") + (sshort ? " (" + sshort + ")" : ""), false));
                            }
                            else {
                                itemRows.push(renderCapsuleRow("main", rspec.label, rview.kind === "usage" ? pct : null, rview.status, rview.summary || "—", false));
                            }
                            var itemChildren = itemRows;
                            var detailText = null;
                            if (rview.kind === "balance" && rview.rateLimited && rview.sub) {
                                detailText = rview.sub;
                            }
                            if (detailText) {
                                itemChildren.push(React.createElement("div", {
                                    key: "detail",
                                    className: "dsh-capsule-detail",
                                    title: detailText
                                }, detailText));
                            }
                            pairs.push(React.createElement("div", {
                                key: rspec.id + "-item",
                                className: "dsh-capsule-item",
                                title: rview.title || ""
                            }, itemChildren));
                        }
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
                var bodyChildren = [];
                if (settingsOpen) {
                    bodyChildren.push(React.createElement(SettingsPanel, {
                        key: "settings",
                        t: t,
                        call: call,
                        specs: specs,
                        settings: settings,
                        onChange: updateSettings,
                        onReset: function () { updateSettings({ hidden: {}, refreshMs: null, warn: {}, proxy: {}, capsuleMode: null, position: null }); }
                    }));
                }
                else if (loadError !== null) {
                    bodyChildren.push(React.createElement("div", { key: "err", className: "dsh-quota-error" }, String(loadError)));
                }
                else if (rows.length === 0) {
                    bodyChildren.push(React.createElement("div", { key: "empty", className: "dsh-provider-sub" }, t("emptyHint")));
                }
                else {
                    // Grouped provider cards isolate themselves; no divider
                    // elements between rows any more.
                    for (var k = 0; k < rows.length; k++) {
                        bodyChildren.push(React.createElement(ProviderRow, { key: rows[k].id, spec: rows[k], view: views[rows[k].id], t: t, holidays: settings.holidays, warn: settings.warn[rows[k].id] }));
                    }
                    var connected = rows.filter(function (r) {
                        var v = views[r.id];
                        return v && v.status !== "error";
                    }).length;
                    bodyChildren.push(React.createElement("div", { key: "footer", className: "dsh-quota-footer" }, React.createElement("span", null, (fetchedAt !== null ? t("updatedAt", { time: new Date(fetchedAt).toLocaleTimeString() }) + " · " : "")
                        + t("footerRefresh", { n: Math.round(effectiveMs / 1000) })), React.createElement("a", {
                        className: "dsh-quota-footer-link",
                        onClick: function () { setSettingsOpen(true); }
                    }, t("footerSettings") + " ⚙")));
                }
                var connectedTotal = rows.filter(function (r) {
                    var v = views[r.id];
                    return v && v.status !== "error";
                }).length;
                return React.createElement("div", { id: "dsh-quota-panel", style: panelStyle }, React.createElement("div", { id: "dsh-quota-card" }, React.createElement("div", Object.assign({}, dragHandlers, { onPointerDown: headerDrag, className: "dsh-quota-header" }), React.createElement("div", { className: "dsh-quota-header-left" }, React.createElement("span", { className: "dsh-quota-title" }, t("title")), React.createElement("span", { className: "dsh-quota-header-badge" }, t("connectedBadge", { n: connectedTotal }))), React.createElement("div", { className: "dsh-quota-actions" }, React.createElement("button", {
                    className: "dsh-quota-icon" + (refreshing ? " is-loading" : ""),
                    type: "button",
                    "aria-label": t("refresh"),
                    disabled: refreshing,
                    onClick: function () { refreshAll(); }
                }, "↻"), React.createElement("button", {
                    className: "dsh-quota-icon" + (settingsOpen ? " is-active" : ""),
                    type: "button",
                    "aria-label": settingsOpen ? t("closeSettings") : t("openSettings"),
                    "aria-expanded": settingsOpen ? "true" : "false",
                    onClick: function () { setSettingsOpen(!settingsOpen); }
                }, "⚙"), React.createElement("button", {
                    className: "dsh-quota-icon",
                    type: "button",
                    "aria-label": t("collapse"),
                    onClick: function () { setExpanded(false); }
                }, "▴"))), bodyChildren));
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
