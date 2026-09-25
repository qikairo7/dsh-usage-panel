/**
 * dsh-usage-panel — session-level token usage and cost panel, host half.
 *
 * Dual-face plugin (scaffolded from dsh-quota-panel-fork, quota logic
 * removed):
 *
 *  - Host half (this file, compiled to lib/index.js; zero runtime
 *    dependencies — the schema library is vendored under src/vendor/):
 *    parses DSH session archives host-side, aggregates call-level usage
 *    into the views of SPEC §3, prices them with a four-mode engine, and
 *    serves everything over loopback Connection RPC routes under /api.
 *
 *  - Client half (src/client.ts → lib/client.js, served at
 *    /plugins/dsh-usage-panel/client.js through the `dsh.client`
 *    manifest): owned by WS3; a placeholder at scaffold stage.
 *
 * Route mounting rides Connection's exact Fetch registry on the
 * authenticated `/api` channel — NOT a dedicated channel prefix. Lesson
 * from quota-panel (DSH 0.1.5): `connection.rpc.handle` mounted from a
 * third-party fiber resolves `owner.webServer` against the Connection
 * plugin's own fiber, which never holds `webServer`, so the route throws
 * inside a child fiber and silently disappears. See src/lib/rpc-envelope.ts.
 *
 * Config keys (validated by the exported `Config` schema):
 *
 *   refreshMs:   incremental rescan floor, default 60000 (>= 5000)
 *   sessionsDir: override the sessions root (default: $DSH_HOME/sessions)
 *   ledgerPath:  override the web-router ledger file (no default until
 *                WS1 fixes the ledger; missing ⇒ ledger() reports
 *                available:false, never a guess)
 */
import os from 'node:os';
import path from 'node:path';
import z from './vendor/schemastery.mjs';
import { RPC_ENDPOINTS, createRpcRoute } from './lib/rpc-envelope.js';
import { dispatchRpc } from './server/rpc.js';
import { createUsageService } from './server/usage-service.js';

export const name = 'usage-panel';

// Evidence for ctx.tools: dsh-mcp-client lib/index.js registers MCP tools via
// `ctx.tools.register(definition)` (returns a disposer); ToolDefinition =
// { name, description, parameters (JSON Schema), execute(args, exec) } per
// @deepseek-ai/dsh-tools lib/types.
//
// The HTTP carrier is injected separately below via ctx.inject(['webServer'])
// — the shipped-plugin pattern (LaoYueHanNi/dsh-token-usage, y2zyyr/
// dsh-token-usage-sidebar). Declaring it in `inject` would make the whole
// plugin fail on profiles without a web server (headless runs), so it stays a
// soft dependency: the browser half simply gets no route there.
export const inject = ['tools'];

/** Default sessions root: $DSH_HOME/sessions (harness sets DSH_HOME). */
function defaultSessionsDir(): string {
	const home = process.env.DSH_HOME;
	const base = home && home.length > 0 ? home : path.join(os.homedir(), '.dsh');
	return path.join(base, 'sessions');
}

/**
 * Persistence root (G2 evidence: reports/g2-g3-g4-evidence.md — DSH keeps
 * all user data under one home root; third-party plugins create their own
 * `<name>/` directory there, like the quota panel does):
 * $DSH_HOME/dsh-usage-panel.
 */
function defaultDataDir(): string {
	const home = process.env.DSH_HOME;
	const base = home && home.length > 0 ? home : path.join(os.homedir(), '.dsh');
	return path.join(base, 'dsh-usage-panel');
}

export const Config = z.object({
	refreshMs: z.number().min(5000).default(60000),
	sessionsDir: z.string(),
	ledgerPath: z.string(),
	dataDir: z.string(),
	priceSnapshotPath: z.string()
});

export function apply(ctx: Context, config: Record<string, any> = {}) {
	const raw: Record<string, any> = config && typeof config === 'object' ? config : {};
	const refreshMs = typeof raw.refreshMs === 'number' && Number.isFinite(raw.refreshMs) ? raw.refreshMs : 60000;
	if (!(refreshMs >= 5000)) throw new Error('usage-panel: config.refreshMs must be >= 5000');
	const sessionsDir = typeof raw.sessionsDir === 'string' && raw.sessionsDir.length > 0 ? raw.sessionsDir : defaultSessionsDir();
	const ledgerPath = typeof raw.ledgerPath === 'string' && raw.ledgerPath.length > 0 ? raw.ledgerPath : null;
	const dataDir = typeof raw.dataDir === 'string' && raw.dataDir.length > 0 ? raw.dataDir : defaultDataDir();
	const priceSnapshotPath = typeof raw.priceSnapshotPath === 'string' && raw.priceSnapshotPath.length > 0 ? raw.priceSnapshotPath : undefined;

	const service = createUsageService({ sessionsDir, ledgerPath, refreshMs, dataDir, priceSnapshotPath });

	// ORDER MATTERS: the browser half mounts first, the agent tool last.
	//
	// `ctx.tools.register` validates its argument at call time and throws on a
	// malformed definition. Because `apply()` is one synchronous fiber body, a
	// throw there aborts everything after it — which is exactly how the first
	// live release died: a missing `output` declaration threw at the tool
	// registration (line order: tool first), so the route mounting below never
	// ran, every browser request fell through to the SPA fallback (404/405),
	// and the market page reported 启动失败. Mounting the data endpoints first
	// means no future tool-contract break can take the panel down with it.

	// Mount the browser half's endpoints on the web server's own route table.
	//
	// Service access uses the synchronous `ctx.get('webServer')` form — the
	// same call the shipped web app itself uses (dsh-web-app/lib/index.js:96
	// `ctx.get("webServer")?.port`). The earlier `ctx.inject(['webServer'], …)`
	// form never fired on this host: the loader entry sits after the web stack
	// has already activated, so the callback never ran and the routes were
	// never mounted (verified live: GET on our endpoint answered 404 while the
	// SPA fallback answered 405 to every POST, including nonexistent paths).
	//
	// Soft dependency by design: a profile without a web server (headless) has
	// no route table; the plugin still serves its tool half there.
	const webServer = (ctx as { get?: (name: string) => any }).get?.('webServer');
	if (webServer === null || webServer === undefined) {
		ctx.logger?.info?.('dsh-usage-panel: no web server in this profile — browser endpoints not mounted');
	} else {
		if (typeof webServer.register !== 'function') {
			throw new Error('usage-panel: webServer service exposes no register() — the browser half would 404 on every request');
		}
		for (const endpoint of RPC_ENDPOINTS) {
			ctx.effect(
				() => webServer.register(createRpcRoute(endpoint, (ep: string, payload: unknown) => dispatchRpc(service, ep, payload))),
				`dsh-usage-panel: ${endpoint} route`
			);
		}
	}

	ctx.tools.register({
		name: 'usage_query',
		description: 'Query aggregated LLM token usage and cost computed from local DSH session archives. Prices use official/community/shadow modes; models without price data report cost:null (unpriced), never 0.',
		parameters: {
			type: 'object',
			properties: {
				since: { type: 'string', description: 'ISO-8601 datetime, lower bound (inclusive). Omit until too for the whole history; since alone covers [since, now).' },
				until: { type: 'string', description: 'ISO-8601 datetime, upper bound (exclusive). until alone covers the whole history up to it.' },
				group_by: {
					type: 'string',
					enum: ['summary', 'day', 'model', 'provider', 'session', 'origin'],
					description: 'summary = one totals row; day = per-local-day rows; model/provider/session/origin = breakdown rows (session rolls subagents into their parent).'
				}
			},
			required: ['group_by']
		},
		// Mandatory (dsh-tools register(): `tool "X" must declare output
		// { schema, render, presentationMeta? }`, then assertSupportedJsonSchema
		// on the schema). The payload is endpoint-shaped and varies with
		// group_by, so the schema types the envelope and accepts any lossless
		// JSON payload inside `result`; `render` is what the model reads.
		output: {
			schema: {
				type: 'object',
				properties: {
					result: { description: 'Aggregated usage payload; the shape follows group_by.' }
				},
				required: ['result'],
				additionalProperties: false
			},
			render: (_args: unknown, value: { result: unknown }) => [
				{ type: 'text' as const, text: JSON.stringify(value.result, null, 2) }
			]
		},
		execute: async (args: unknown) => {
			const a = (args ?? {}) as Record<string, unknown>;
			const groupBy = a.group_by;
			if (typeof groupBy !== 'string') throw new Error('usage_query: group_by must be a string');
			let since: string | undefined;
			let until: string | undefined;
			if (a.since !== undefined && a.since !== null) {
				if (typeof a.since !== 'string' || Number.isNaN(Date.parse(a.since))) throw new Error(`usage_query: since must be an ISO datetime, got ${JSON.stringify(a.since)}`);
				since = a.since;
			}
			if (a.until !== undefined && a.until !== null) {
				if (typeof a.until !== 'string' || Number.isNaN(Date.parse(a.until))) throw new Error(`usage_query: until must be an ISO datetime, got ${JSON.stringify(a.until)}`);
				until = a.until;
			}
			// Open-ended bounds are honored, never silently dropped (Anti-Postel):
			// since-only ⇒ [since, now); until-only ⇒ [epoch, until); both ⇒ as
			// given; neither ⇒ whole history.
			let range: 'all' | { from: string; to: string };
			if (since !== undefined && until !== undefined) range = { from: since, to: until };
			else if (since !== undefined) range = { from: since, to: new Date(Date.now() + 60_000).toISOString() };
			else if (until !== undefined) range = { from: new Date(0).toISOString(), to: until };
			else range = 'all';
			let payload: unknown;
			switch (groupBy) {
				case 'summary':
					payload = await service.summary(range);
					break;
				case 'day':
					payload = await service.timeseries(range, 'day');
					break;
				case 'model':
					payload = await service.breakdown(range, 'model');
					break;
				case 'provider':
					payload = await service.breakdown(range, 'provider');
					break;
				case 'session':
					payload = await service.breakdown(range, 'session');
					break;
				case 'origin':
					payload = await service.breakdown(range, 'origin');
					break;
				default:
					throw new Error(`usage_query: group_by must be one of summary|day|model|provider|session|origin, got ${JSON.stringify(groupBy)}`);
			}
			return { result: payload };
		}
	});
}

/** Minimal ambient shape; the host provides the real Context at runtime. */
interface Context {
	tools: {
		/** `output` is mandatory: register() throws without { schema, render }. */
		register(definition: {
			name: string;
			description: string;
			parameters: Record<string, unknown>;
			output: { schema: Record<string, unknown>; render(args: unknown, value: any): unknown[]; presentationMeta?(args: unknown, value: any): unknown };
			execute: (args: unknown, exec: unknown) => Promise<unknown>;
		}): unknown;
	};
	/** Cordis effect: setup runs now, the returned disposer runs on fiber teardown. */
	effect(callback: () => void | (() => void), label?: string): unknown;
	/** Synchronous service lookup (cordis): undefined when the service is absent. */
	get?(name: string): any;
	logger?: { info?(message: string): void; warn?(message: string): void; error?(...args: unknown[]): void };
}
