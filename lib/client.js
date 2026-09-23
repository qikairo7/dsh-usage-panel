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
            '#dsh-quota-panel{position:fixed;right:18px;bottom:18px;z-index:900;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto;color:var(--dsw-alias-label-primary,#1b1b1c);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
            '#dsh-quota-capsule{display:inline-flex;align-items:center;gap:9px;height:32px;max-width:calc(100vw - 36px);box-sizing:border-box;padding:0 12px 0 12px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.08));border-radius:9999px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,0.85));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--dsw-shadow-lv2,0 2px 8px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.02));cursor:pointer;font:inherit;outline:none;user-select:none;touch-action:none;transform:translateY(0);transition:transform 180ms cubic-bezier(0.16,1,0.3,1),box-shadow 180ms ease,background-color 150ms ease,border-color 150ms ease;animation:dsh-quota-capsule-enter 200ms cubic-bezier(0.16,1,0.3,1)}',
            '#dsh-quota-capsule:hover{transform:translateY(-1px);background:var(--dsw-alias-bg-overlay,rgba(240,242,245,0.92));border-color:var(--dsw-alias-border-l3,rgba(0,0,0,0.14));box-shadow:var(--dsw-shadow-lv3,0 6px 16px rgba(0,0,0,0.08),0 2px 4px rgba(0,0,0,0.04))}',
            '#dsh-quota-capsule:active{transform:translateY(0);box-shadow:var(--dsw-shadow-lv1,0 1px 3px rgba(0,0,0,0.06))}',
            '#dsh-quota-capsule .dsh-capsule-group{display:inline-flex;align-items:center;gap:4px;min-width:0;flex-shrink:0}',
            '#dsh-quota-capsule .dsh-capsule-name{font-size:11.5px;font-weight:600;letter-spacing:-0.01em;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52px}',
            '#dsh-quota-capsule .dsh-capsule-ring{display:inline-block;flex:none;width:16px;height:16px;border-radius:50%;--rp:var(--dsh-ring-pct,0);--rc:var(--dsw-static-neutral-bluish-400,#adb2b8);background:conic-gradient(var(--rc) calc(var(--rp) * 1%), var(--dsw-alias-bg-raised,rgba(0,0,0,0.08)) 0);-webkit-mask:radial-gradient(circle,transparent 0 4.5px,#000 4.5px);mask:radial-gradient(circle,transparent 0 4.5px,#000 4.5px);transition:background-color 160ms ease}',
            '#dsh-quota-capsule .dsh-capsule-ring.state-ok{--rc:var(--dsw-static-green-500,#22c55e)}',
            '#dsh-quota-capsule .dsh-capsule-ring.state-warn{--rc:var(--dsw-static-amber-500,#f59e0b)}',
            '#dsh-quota-capsule .dsh-capsule-ring.state-error{--rc:var(--dsw-static-red-500,#ef4444)}',
            '#dsh-quota-capsule .dsh-capsule-ring.state-info{--rc:var(--dsw-static-deepseek-500,#4176e6)}',
            '#dsh-quota-capsule .dsh-capsule-item{font-size:12px;font-weight:550;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;white-space:nowrap;color:var(--dsw-alias-label-primary,#1b1b1c);transition:color 150ms ease;flex-shrink:0}',
            '#dsh-quota-capsule .dsh-capsule-item.state-loading{color:var(--dsw-alias-label-secondary,#61666b);font-weight:400}',
            '#dsh-quota-capsule .dsh-capsule-item.state-warn{color:var(--dsw-static-amber-600,var(--dsw-static-amber-500,#d97706))}',
            '#dsh-quota-capsule .dsh-capsule-item.state-error{color:var(--dsw-static-red-500,#ef4444)}',
            '#dsh-quota-capsule .dsh-capsule-item.state-ok.dsh-usage{color:var(--dsw-alias-label-primary,#1b1b1c)}',
            '#dsh-quota-capsule .dsh-capsule-more{display:inline-flex;align-items:center;padding:1px 5px;border-radius:999px;background:var(--dsw-alias-bg-raised,rgba(0,0,0,0.05));font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#818590);white-space:nowrap;flex-shrink:0}',
            '#dsh-quota-capsule .dsh-capsule-more.state-warn{color:var(--dsw-static-amber-600,var(--dsw-static-amber-500,#d97706));background:var(--dsw-alias-color-warning-bg,rgba(180,83,9,.12))}',
            '#dsh-quota-capsule .dsh-capsule-more.state-error{color:var(--dsw-static-red-500,#ef4444);background:rgba(239,68,68,0.12)}',
            '#dsh-quota-capsule .dsh-capsule-chevron{color:var(--dsw-alias-label-tertiary,#818590);font-size:9px;line-height:1;opacity:0.75;margin-left:-2px;transition:transform 180ms ease,opacity 150ms ease}',
            '#dsh-quota-capsule:hover .dsh-capsule-chevron{opacity:1}',
            '#dsh-quota-card{width:320px;max-width:calc(100vw - 36px);max-height:calc(100vh - 36px);margin-top:8px;padding:16px 18px;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.08));border-radius:18px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,0.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(15,17,21,0.08),0 3px 10px rgba(15,17,21,0.04));box-sizing:border-box;transform-origin:bottom right;animation:dsh-quota-card-enter 220ms cubic-bezier(0.16,1,0.3,1)}',
            '#dsh-quota-card .dsh-quota-header{position:sticky;top:-16px;z-index:2;display:flex;align-items:center;justify-content:space-between;min-height:28px;margin-top:-4px;margin-bottom:14px;padding-top:16px;padding-bottom:2px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,0.92));cursor:grab;user-select:none;touch-action:none}',
            '#dsh-quota-card .dsh-quota-title{color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:600;line-height:20px;letter-spacing:-0.01em}',
            '#dsh-quota-card .dsh-quota-actions{display:flex;align-items:center;gap:4px}',
            '#dsh-quota-card .dsh-quota-icon{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:1px solid transparent;border-radius:7px;color:var(--dsw-alias-label-secondary,#61666b);background:transparent;font-size:14px;line-height:1;cursor:pointer;outline:none;transition:color 150ms ease,background-color 150ms ease,border-color 150ms ease,transform 120ms ease}',
            '#dsh-quota-card .dsh-quota-icon:hover{color:var(--dsw-alias-label-primary,#1b1b1c);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.05))}',
            '#dsh-quota-card .dsh-quota-icon:active{transform:scale(0.94)}',
            '#dsh-quota-card .dsh-quota-icon:disabled{cursor:default;opacity:0.4;transform:none}',
            '#dsh-quota-card .dsh-quota-icon.is-loading{animation:dsh-quota-spin 0.75s cubic-bezier(0.4,0,0.2,1) infinite}',
            '#dsh-quota-card .dsh-quota-icon.is-active{color:var(--dsw-static-deepseek-500,#4176e6);background:var(--dsw-alias-interactive-bg-active,rgba(65,118,230,0.1))}',
            '@keyframes dsh-quota-spin{to{transform:rotate(360deg)}}',
            '@keyframes dsh-quota-card-enter{from{opacity:0;transform:scale(0.96) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}',
            '@keyframes dsh-quota-capsule-enter{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}',
            '#dsh-quota-card .dsh-provider{width:100%}',
            '#dsh-quota-card .dsh-provider-main{display:flex;align-items:flex-start;gap:10px}',
            '#dsh-quota-card .dsh-status-dot{flex:none;width:6px;height:6px;margin-top:6px;border-radius:50%;background:var(--dsw-static-green-500,#22c55e);box-shadow:0 0 0 2px rgba(34,197,94,0.18);transition:background-color 160ms ease,box-shadow 160ms ease}',
            '#dsh-quota-card .state-loading .dsh-status-dot{background:var(--dsw-static-neutral-bluish-400,#adb2b8);box-shadow:0 0 0 2px rgba(173,178,184,0.15)}',
            '#dsh-quota-card .state-warn .dsh-status-dot{background:var(--dsw-static-amber-500,#f59e0b);box-shadow:0 0 0 2px rgba(245,158,11,0.2)}',
            '#dsh-quota-card .state-error .dsh-status-dot{background:var(--dsw-static-red-500,#ef4444);box-shadow:0 0 0 2px rgba(239,68,68,0.2)}',
            '#dsh-quota-card .state-info .dsh-status-dot{background:var(--dsw-static-deepseek-500,#4176e6);box-shadow:0 0 0 2px rgba(65,118,230,0.18)}',
            '#dsh-quota-card .dsh-provider-body{flex:1;min-width:0}',
            '#dsh-quota-card .dsh-provider-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
            '#dsh-quota-card .dsh-provider-name{overflow:hidden;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:550;letter-spacing:-0.01em;text-overflow:ellipsis;white-space:nowrap}',
            '#dsh-quota-card .dsh-provider-value{flex:none;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
            '#dsh-quota-card .state-warn .dsh-provider-value{color:var(--dsw-static-amber-600,var(--dsw-static-amber-500,#d97706))}',
            '#dsh-quota-card .state-error .dsh-provider-value{color:var(--dsw-static-red-500,#ef4444)}',
            '#dsh-quota-card .dsh-provider-sub{margin-top:2px;color:var(--dsw-alias-label-secondary,#61666b);font-size:11.5px;line-height:16px}',
            '#dsh-quota-card .dsh-quota-divider{height:1px;margin:11px 0;background:var(--dsw-alias-border-l1,rgba(0,0,0,0.06))}',
            '#dsh-quota-card .dsh-usage-values{margin-top:3px;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;letter-spacing:-0.005em}',
            '#dsh-quota-card .dsh-peak-badge{display:inline-block;margin-left:6px;padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;font-weight:500;vertical-align:1px;letter-spacing:0}',
            '#dsh-quota-card .dsh-peak-badge.state-peak{background:var(--dsw-alias-color-warning-bg,rgba(180,83,9,.12));color:var(--dsw-alias-color-warning,#b45309)}',
            '#dsh-quota-card .dsh-peak-badge.state-off{background:var(--dsw-alias-color-success-bg,rgba(21,128,61,.12));color:var(--dsw-alias-color-success,#15803d)}',
            '#dsh-quota-card .dsh-progress{position:relative;width:100%;height:4.5px;margin-top:7px;overflow:hidden;border-radius:9999px;background:var(--dsw-alias-border-l1,rgba(0,0,0,0.06))}',
            '#dsh-quota-card .dsh-progress-fill{height:100%;width:0;border-radius:inherit;background:var(--dsw-static-deepseek-500,#4176e6);transition:width 240ms cubic-bezier(0.16,1,0.3,1),background-color 160ms ease}',
            '#dsh-quota-card .state-warn .dsh-progress-fill{background:var(--dsw-static-amber-500,#f59e0b)}',
            '#dsh-quota-card .state-error .dsh-progress-fill{background:var(--dsw-static-red-500,#ef4444)}',
            '#dsh-quota-card .dsh-usage-caption{margin-top:6px;color:var(--dsw-alias-label-tertiary,#818590);font-size:11px;line-height:15px}',
            '#dsh-quota-card .dsh-quota-error{color:var(--dsw-static-red-500,#ef4444);font-size:12px;line-height:17px;word-break:break-all}',
            '#dsh-quota-card .dsh-quota-settings{max-height:calc(100vh - 120px);overflow-y:auto;overflow-x:hidden;padding-right:2px;animation:dsh-quota-settings-fade 180ms cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3,rgba(0,0,0,0.18)) transparent}',
            '#dsh-quota-card .dsh-quota-settings::-webkit-scrollbar,#dsh-quota-card .dsh-setting-scroll-list::-webkit-scrollbar{width:4px}',
            '#dsh-quota-card .dsh-quota-settings::-webkit-scrollbar-thumb,#dsh-quota-card .dsh-setting-scroll-list::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l3,rgba(0,0,0,0.18));border-radius:9999px}',
            '#dsh-quota-card .dsh-quota-settings::-webkit-scrollbar-track,#dsh-quota-card .dsh-setting-scroll-list::-webkit-scrollbar-track{background:transparent}',
            '@keyframes dsh-quota-settings-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
            '@keyframes dsh-setting-section-enter{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
            '#dsh-quota-card .dsh-setting-section{margin-bottom:14px;animation:dsh-setting-section-enter 200ms cubic-bezier(0.16,1,0.3,1) both}',
            '#dsh-quota-card .dsh-setting-section:nth-child(1){animation-delay:0ms}',
            '#dsh-quota-card .dsh-setting-section:nth-child(2){animation-delay:30ms}',
            '#dsh-quota-card .dsh-setting-section:nth-child(3){animation-delay:60ms}',
            '#dsh-quota-card .dsh-setting-section:nth-child(n+4){animation-delay:90ms}',
            '#dsh-quota-card .dsh-setting-sub-section{margin-top:10px;padding-top:10px;border-top:1px dashed var(--dsw-alias-border-l1,rgba(0,0,0,0.06))}',
            '#dsh-quota-card .dsh-setting-title{margin-bottom:6px;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;font-weight:600;line-height:16px;letter-spacing:0.02em;text-transform:uppercase}',
            '#dsh-quota-card .dsh-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 6px;border-radius:6px;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:12.5px;line-height:18px;transition:background-color 140ms ease}',
            '#dsh-quota-card .dsh-setting-row-interactive:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.04))}',
            '#dsh-quota-card .dsh-setting-name-wrap{display:flex;align-items:center;gap:6px;min-width:0;flex:1}',
            '#dsh-quota-card .dsh-setting-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '#dsh-quota-card .dsh-setting-badge{flex:none;font-size:10px;font-weight:550;line-height:13px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-raised,rgba(0,0,0,0.05));color:var(--dsw-alias-label-secondary,#61666b);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,0.06))}',
            '#dsh-quota-card .dsh-setting-badge-usage{color:var(--dsw-static-deepseek-500,#4176e6);background:var(--dsw-alias-interactive-bg-active,rgba(65,118,230,0.08));border-color:rgba(65,118,230,0.18)}',
            '#dsh-quota-card .dsh-setting-badge-balance{color:var(--dsw-static-green-600,var(--dsw-static-green-500,#16a34a));background:rgba(34,197,94,0.08);border-color:rgba(34,197,94,0.18)}',
            '#dsh-quota-card .dsh-setting-scroll-list{max-height:180px;overflow-y:auto;overflow-x:hidden;padding-right:3px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3,rgba(0,0,0,0.18)) transparent}',
            '#dsh-quota-card .dsh-setting-toggle{position:relative;display:inline-flex;align-items:center;cursor:pointer;user-select:none;flex:none}',
            '#dsh-quota-card .dsh-setting-toggle-input{position:absolute;opacity:0;width:0;height:0;margin:0;pointer-events:none}',
            '#dsh-quota-card .dsh-setting-toggle-track{display:block;width:32px;height:18px;border-radius:9999px;background:var(--dsw-alias-border-l3,rgba(0,0,0,0.18));position:relative;transition:background-color 160ms cubic-bezier(0.16,1,0.3,1),box-shadow 160ms ease;box-sizing:border-box}',
            '#dsh-quota-card .dsh-setting-toggle-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.2),0 0.5px 1px rgba(0,0,0,0.12);transition:transform 160ms cubic-bezier(0.16,1,0.3,1),width 120ms ease}',
            '#dsh-quota-card .dsh-setting-toggle-input:checked+.dsh-setting-toggle-track{background:var(--dsw-static-deepseek-500,#4176e6)}',
            '#dsh-quota-card .dsh-setting-toggle-input:checked+.dsh-setting-toggle-track .dsh-setting-toggle-thumb{transform:translateX(14px)}',
            '#dsh-quota-card .dsh-setting-toggle:active .dsh-setting-toggle-thumb{width:16px}',
            '#dsh-quota-card .dsh-setting-toggle-input:focus-visible+.dsh-setting-toggle-track{box-shadow:0 0 0 2px rgba(65,118,230,0.35)}',
            '#dsh-quota-card .dsh-setting-segmented{display:flex;align-items:center;width:100%;padding:2.5px;border-radius:8px;background:var(--dsw-alias-bg-raised,rgba(0,0,0,0.04));border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,0.06));box-sizing:border-box;gap:2px}',
            '#dsh-quota-card .dsh-setting-seg-btn{flex:1;padding:4px 2px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;font-size:11px;font-weight:500;line-height:16px;text-align:center;cursor:pointer;outline:none;white-space:nowrap;user-select:none;font-variant-numeric:tabular-nums;transition:background-color 150ms ease,color 150ms ease,box-shadow 150ms ease}',
            '#dsh-quota-card .dsh-setting-seg-btn:hover{color:var(--dsw-alias-label-primary,#1b1b1c)}',
            '#dsh-quota-card .dsh-setting-seg-btn.is-active{background:var(--dsw-alias-bg-layer-1,#ffffff);color:var(--dsw-alias-label-primary,#1b1b1c);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 0.5px 1px rgba(0,0,0,0.04);border-color:var(--dsw-alias-border-l1,rgba(0,0,0,0.04))}',
            '#dsh-quota-card .dsh-setting-seg-btn:focus-visible{box-shadow:0 0 0 2px rgba(65,118,230,0.35)}',
            '#dsh-quota-card .dsh-setting-input,#dsh-quota-card .dsh-setting-select{width:108px;padding:3px 7px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.12));border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1b1b1c);font:inherit;font-size:11.5px;font-variant-numeric:tabular-nums;line-height:16px;box-sizing:border-box;outline:none;transition:border-color 140ms ease,box-shadow 140ms ease}',
            '#dsh-quota-card .dsh-setting-input:focus,#dsh-quota-card .dsh-setting-select:focus{border-color:var(--dsw-static-deepseek-500,#4176e6);box-shadow:0 0 0 2px rgba(65,118,230,0.14)}',
            '#dsh-quota-card .dsh-setting-number{text-align:right;width:88px}',
            '#dsh-quota-card .dsh-setting-proxy{width:148px}',
            '#dsh-quota-card .dsh-setting-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,0.06))}',
            '#dsh-quota-card .dsh-setting-hint{color:var(--dsw-alias-label-tertiary,#818590);font-size:11px;line-height:15px}',
            '#dsh-quota-card .dsh-setting-reset{padding:3px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.12));border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;font-size:11.5px;line-height:16px;cursor:pointer;outline:none;transition:color 140ms ease,background-color 140ms ease,border-color 140ms ease,transform 100ms ease}',
            '#dsh-quota-card .dsh-setting-reset:hover{color:var(--dsw-alias-label-primary,#1b1b1c);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.05));border-color:var(--dsw-alias-border-l3,rgba(0,0,0,0.18))}',
            '#dsh-quota-card .dsh-setting-reset:active{transform:scale(0.97)}',
            '#dsh-quota-card .dsh-setting-reset:disabled{opacity:0.45;cursor:default;transform:none}',
            '#dsh-quota-card .dsh-chatgpt-row{align-self:stretch}',
            '#dsh-quota-card .dsh-chatgpt-url a{color:var(--dsw-alias-brand,#3b82f6);font-size:11px;word-break:break-all;text-decoration:none}',
            '#dsh-quota-card .dsh-chatgpt-url a:hover{text-decoration:underline}',
            '#dsh-quota-card .dsh-chatgpt-code-row{display:flex;align-items:center;gap:8px}',
            '#dsh-quota-card .dsh-chatgpt-code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:15px;font-weight:600;letter-spacing:1.5px;padding:4px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.12));border-radius:6px;background:var(--dsw-alias-bg-raised,rgba(0,0,0,0.03))}',
            '@media (prefers-reduced-motion: reduce){#dsh-quota-capsule,#dsh-quota-card,#dsh-quota-card .dsh-quota-settings,#dsh-quota-card .dsh-setting-section,#dsh-quota-card .dsh-progress-fill,#dsh-quota-card .dsh-quota-icon,#dsh-quota-card .dsh-setting-reset,#dsh-quota-capsule .dsh-capsule-ring,#dsh-quota-capsule .dsh-capsule-name,#dsh-quota-capsule .dsh-capsule-more,#dsh-quota-card .dsh-status-dot,#dsh-quota-card .dsh-setting-toggle-track,#dsh-quota-card .dsh-setting-toggle-thumb,#dsh-quota-card .dsh-setting-seg-btn{animation:none;transition:none;transform:none}}'
        ].join("\n");
        var CAPSULE_CHOICES = [
            { value: "auto" },
            { value: "rolling" },
            { value: "weekly" },
            { value: "max" }
        ];
        var CAPSULE_MODES = { auto: true, rolling: true, weekly: true, max: true };
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
            return (d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + hm;
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
                return {
                    kind: "usage", status: status, summary: shownPct + "%", value: null,
                    usageText: textSegs.join(" · "),
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
                sub = rateReset ? t("rateLimitedReset", { time: rateReset }) : t("rateLimited");
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
            var shown = (spec.currency || "¥") + amount.toFixed(2);
            return {
                kind: "balance", status: status2, summary: shown,
                value: shown, sub: sub, usageText: null, barPercent: 0, caption: "",
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
            var children = [
                React.createElement("span", { key: "dot", className: "dsh-status-dot" })
            ];
            var headChildren = [React.createElement("span", { key: "name", className: "dsh-provider-name" }, spec.label)];
            var peak = t ? peakStatus(spec.id, props.holidays) : null;
            if (peak) {
                var peakText = peak.inPeak ? t("peakBadge") : t(peak.kind === "glm" ? "offPeak50" : "offPeakHalf");
                headChildren.push(React.createElement("span", {
                    key: "peak",
                    className: "dsh-peak-badge state-" + (peak.inPeak ? "peak" : "off")
                }, peakText));
            }
            if (view.value !== null && view.value !== undefined) {
                headChildren.push(React.createElement("span", { key: "value", className: "dsh-provider-value" }, view.value));
            }
            var body = [React.createElement("div", { key: "head", className: "dsh-provider-head" }, headChildren)];
            if (view.kind === "usage") {
                body.push(React.createElement("div", { key: "usage", className: "dsh-usage-values" }, view.usageText));
                body.push(React.createElement("div", { key: "track", className: "dsh-progress" }, React.createElement("div", { className: "dsh-progress-fill", style: { width: view.barPercent + "%" } })));
                if (view.caption)
                    body.push(React.createElement("div", { key: "cap", className: "dsh-usage-caption" }, view.caption));
            }
            else if (view.sub) {
                body.push(React.createElement("div", { key: "sub", className: "dsh-provider-sub" }, view.sub));
            }
            children.push(React.createElement("div", { key: "body", className: "dsh-provider-body" }, body));
            return React.createElement("div", { className: "dsh-provider state-" + view.status, title: view.title }, React.createElement("div", { className: "dsh-provider-main" }, children));
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
                children.push(React.createElement("div", { key: "code", className: "dsh-chatgpt-code-row" }, React.createElement("span", { className: "dsh-chatgpt-code" }, login.userCode), React.createElement("button", {
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
            var holidaysSection = React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("holidaysTitle")), React.createElement("div", { className: "dsh-setting-row dsh-setting-row-interactive", style: { flexDirection: "column", alignItems: "stretch", gap: "4px" } }, React.createElement("input", { className: "dsh-setting-input", type: "text", placeholder: "2026-10-01,2026-10-02", value: settings.holidays || "", onChange: function (e) { setHolidays(e.target.value); } }), React.createElement("div", { className: "dsh-setting-hint" }, t("holidaysHint"))));
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
            return React.createElement("div", { className: "dsh-quota-settings" }, React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsProviders")), visibilityRows.length ? React.createElement("div", { className: "dsh-setting-scroll-list" }, visibilityRows) : React.createElement("div", { className: "dsh-setting-hint" }, t("settingsNoProviders"))), holidaysSection, React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsInterval")), React.createElement("div", { className: "dsh-setting-row" }, React.createElement("span", { className: "dsh-setting-name" }, t("settingsAutoRefresh")), React.createElement("select", {
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
            }))), React.createElement("div", { className: "dsh-setting-row", style: { marginTop: "6px", flexDirection: "column", alignItems: "stretch", gap: "6px" } }, React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, React.createElement("span", { className: "dsh-setting-name" }, t("capsuleName")), React.createElement("span", { className: "dsh-setting-hint" }, (settings.capsuleMode || "auto") === "auto" ? t("capsuleAuto") : (settings.capsuleMode === "rolling" ? t("capsuleRolling") : (settings.capsuleMode === "weekly" ? t("capsuleWeekly") : t("capsuleMax"))))), React.createElement("div", { className: "dsh-setting-segmented", role: "radiogroup", "aria-label": t("capsuleName") }, CAPSULE_CHOICES.map(function (choice) {
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
            })))), React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsThresholds")), thresholdRows.filter(Boolean).length ? React.createElement("div", { className: "dsh-setting-scroll-list" }, thresholdRows) : null), React.createElement("div", { className: "dsh-setting-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsAdvanced")), React.createElement("div", { className: "dsh-setting-row dsh-setting-row-interactive" }, React.createElement("span", { className: "dsh-setting-name" }, t("panelPosition")), React.createElement("button", {
                className: "dsh-setting-reset",
                type: "button",
                onClick: resetPosition,
                disabled: !settings.position
            }, settings.position ? t("resetPosition") : t("defaultPosition"))), React.createElement("div", { className: "dsh-setting-sub-section" }, React.createElement("div", { className: "dsh-setting-title" }, t("settingsProxy")), React.createElement("div", { className: "dsh-setting-hint", style: { marginBottom: "4px" } }, t("proxyHint")), proxyRows.length ? React.createElement("div", { className: "dsh-setting-scroll-list" }, proxyRows) : null), React.createElement(ChatGPTAccount, { key: "chatgpt", t: t, call: call, settings: settings, onChange: onChange })), React.createElement("div", { className: "dsh-setting-actions" }, React.createElement("span", { className: "dsh-setting-hint" }, t("localOnly")), React.createElement("button", { className: "dsh-setting-reset", type: "button", onClick: onReset }, t("resetDefaults"))));
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
                        pairs.push(React.createElement("span", { key: "err", className: "dsh-capsule-item state-error" }, "—"));
                        ariaLabel = t("expand") + ": " + String(loadError);
                    }
                    else if (rows.length === 0) {
                        pairs.push(React.createElement("span", { key: "none", className: "dsh-capsule-item state-loading" }, t("allHidden")));
                        ariaLabel = t("allHidden") + " · " + t("expand");
                    }
                    else {
                        var statusWeight = function (st) {
                            return st === "error" ? 3 : st === "warn" ? 2 : 1;
                        };
                        var sortedRows = rows.slice().sort(function (a, b) {
                            var va = views[a.id];
                            var vb = views[b.id];
                            var wa = statusWeight(va ? va.status : "ok");
                            var wb = statusWeight(vb ? vb.status : "ok");
                            if (wb !== wa)
                                return wb - wa;
                            var pa = va && typeof va.barPercent === "number" ? va.barPercent : -1;
                            var pb = vb && typeof vb.barPercent === "number" ? vb.barPercent : -1;
                            if (pb !== pa)
                                return pb - pa;
                            return 0;
                        });
                        var topRow = sortedRows[0];
                        var topView = views[topRow.id] || {};
                        var pct = typeof topView.barPercent === "number" && Number.isFinite(topView.barPercent)
                            ? Math.min(Math.max(topView.barPercent, 0), 100)
                            : 0;
                        pairs.push(React.createElement("span", { key: topRow.id + "-group", className: "dsh-capsule-group" }, React.createElement("span", {
                            key: "ring",
                            className: "dsh-capsule-ring state-" + (topView.status || "ok"),
                            style: { "--dsh-ring-pct": pct }
                        }), React.createElement("span", { key: "name", className: "dsh-capsule-name" }, topRow.short || topRow.label), React.createElement("span", {
                            key: "value",
                            className: "dsh-capsule-item state-" + (topView.status || "ok") + (topView.kind === "usage" ? " dsh-usage" : "")
                        }, topView.summary)));
                        var overflowRows = sortedRows.slice(1);
                        if (overflowRows.length > 0) {
                            var hasErr = overflowRows.some(function (r) { return views[r.id] && views[r.id].status === "error"; });
                            var hasWarn = overflowRows.some(function (r) { return views[r.id] && views[r.id].status === "warn"; });
                            if (hasErr || hasWarn) {
                                var moreState = hasErr ? "error" : "warn";
                                pairs.push(React.createElement("span", {
                                    key: "overflow-more",
                                    className: "dsh-capsule-more state-" + moreState
                                }, "+" + overflowRows.length));
                            }
                        }
                        var ariaParts = [];
                        for (var a = 0; a < rows.length; a++) {
                            var arspec = rows[a];
                            var aview = views[arspec.id];
                            var aname = arspec.short || arspec.label;
                            var asummary = aview ? aview.summary : "";
                            ariaParts.push(aname + " " + asummary);
                        }
                        ariaLabel = ariaParts.join("，") + " · " + t("expand");
                    }
                    pairs.push(React.createElement("span", { key: "chevron", className: "dsh-capsule-chevron" }, "▾"));
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
                    for (var k = 0; k < rows.length; k++) {
                        if (k > 0)
                            bodyChildren.push(React.createElement("div", { key: rows[k].id + "-div", className: "dsh-quota-divider" }));
                        bodyChildren.push(React.createElement(ProviderRow, { key: rows[k].id, spec: rows[k], view: views[rows[k].id], t: t, holidays: settings.holidays }));
                    }
                    if (fetchedAt !== null) {
                        bodyChildren.push(React.createElement("div", { key: "at", className: "dsh-quota-divider" }));
                        bodyChildren.push(React.createElement("div", { key: "at-text", className: "dsh-usage-caption" }, t("updatedAt", { time: new Date(fetchedAt).toLocaleTimeString() })));
                    }
                }
                return React.createElement("div", { id: "dsh-quota-panel", style: panelStyle }, React.createElement("div", { id: "dsh-quota-card" }, React.createElement("div", Object.assign({}, dragHandlers, { onPointerDown: headerDrag, className: "dsh-quota-header" }), React.createElement("div", { className: "dsh-quota-title" }, t("title")), React.createElement("div", { className: "dsh-quota-actions" }, React.createElement("button", {
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
