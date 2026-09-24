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
export {};
