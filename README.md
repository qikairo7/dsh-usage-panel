# dsh-usage-panel

DeepSeek Harness（DSH）会话级 **Token 用量与费用统计面板**插件：解析本机会话存档，在 Web GUI 内回答「今天/本月烧了多少 token、多少钱、烧在哪」。

## 功能

- **三面 UI（Apple 风格）**
  - 侧栏主看板：时间筛选（今日/本周/本月/全部）、每日趋势图、模型 × Provider 分解、会话消耗 Top（子 Agent 派生用量归并主会话）、主/子 Agent 拆分、cache 命中率、调用级明细表（分页 + 筛选）、web-router 账本区
  - Composer 底部状态条：今日 token 与估算费用，点击展开看板
  - 常驻 Dock：今日 / 本月两组数字
- **费用四态计价**，口径透明、绝不静默按 0 计：
  - `official` 官网牌价快照（cache 分档计价，来源与更新时间可见）
  - `community` 社区源可选刷新（OpenRouter / LiteLLM，显式手动触发）
  - `shadow` 订阅/中转线按背后模型官方牌价折算，标注「订阅线·影子成本」
  - `unpriced` 显式未定价，绝不显示 ¥0
- **web-router 账本整合**：付费检索渠道调用次数与人民币折算（按渠道单价表），账本缺失时优雅空态
- **usage_query 工具**：agent 可在对话中直接查询用量（`since` / `until` / `group_by`）
- **本地优先**：只读本机会话存档与账本，聚合数据存于本机 DSH 数据目录；无遥测、无数据外发（社区价格刷新为显式操作，仅拉取价格数字）

## 安装

```bash
dsh plugin add github:qikairo7/dsh-usage-panel --profile <你的profile>
```

安装后刷新 Web GUI，侧栏出现「用量」面板。

## 数据与口径说明

- 数据源：DSH 会话存档（zstd 多帧 JSONL），增量水位扫描，全量历史回溯；聚合数字可逐级对回明细求和
- 计价是**牌价折算的核算口径**，不代表订阅制通道的真实账单支出
- 价格快照带 `_caveats` 字段记录注意事项（如限时价到期时间、待确认模型）

## 开发

```bash
npm run check        # lint(tsc strict) && test && build
node scripts/smoke-corpus.mjs   # 真实全库冒烟（读取本机 DSH 数据目录）
```

## English

**dsh-usage-panel** is a session-level token usage & cost dashboard plugin for DeepSeek Harness (DSH). It parses local session archives (multi-frame zstd JSONL) with incremental watermark scanning and renders an Apple-style UI in the DSH Web GUI: a sidebar dashboard (daily trends, model × provider breakdown, session top-N with sub-agent rollup, main/sub-agent split, cache hit rate, call-level detail table, web-router ledger section), a composer status bar, and a persistent dock.

Costs use a four-mode pricing model — official snapshot, optional community refresh (OpenRouter/LiteLLM), shadow pricing for subscription/relay lines, and explicit **unpriced** (never silently zero). An agent-facing `usage_query` tool is included. Local-first: no telemetry, no data leaves your machine.

Install: `dsh plugin add github:qikairo7/dsh-usage-panel --profile <profile>`

## License

[MIT](LICENSE)
