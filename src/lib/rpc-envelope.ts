/**
 * Plain-HTTP route helpers for the usage panel's host half.
 *
 * Mechanism provenance (two shipped plugins, read side by side):
 *   - LaoYueHanNi/dsh-token-usage  → ctx.inject(['webServer'], …) +
 *     webCtx.effect(() => webCtx.webServer.register({kind:'exact', path, handler}))
 *   - y2zyyr/dsh-token-usage-sidebar → same webServer.register shape
 * Both serve the browser half over plain `fetch('/<namespace>/…')` on the
 * web server's own route table, fenced by `sec-fetch-site`.
 *
 * The earlier Connection-channel design (`connection.fetch.register` under
 * `/api` + `connection.rpc.call`) is NOT used by any shipped plugin and was
 * never served on this host: every request answered HTTP 404. Route ownership
 * here is the web server's, not Connection's.
 */

/** Path prefix this plugin owns on the web server. */
export const RPC_BASE_PATH = '/usage-panel/api';

/** RPC endpoints served by the host half (SPEC §3). */
export const RPC_ENDPOINTS = [
	'summary',
	'timeseries',
	'breakdown',
	'detail',
	'pricing',
	'refresh',
	'ledger'
] as const;

export type RpcEndpoint = (typeof RPC_ENDPOINTS)[number];

/** Absolute route path the browser half fetches for one endpoint. */
export function rpcHttpPath(endpoint: string): string {
	return `${RPC_BASE_PATH}/${endpoint}`;
}

/** Failure result shape the browser half rejects on. */
export function rpcError(code: string, message: string, details: Record<string, unknown> = {}): Record<string, unknown> {
	return { ok: false, error: { code, message, details } };
}

/** Minimal Node HTTP shapes (the web server's handler signature). */
interface NodeRequest {
	method?: string;
	headers: Record<string, string | string[] | undefined>;
	[Symbol.asyncIterator](): AsyncIterator<unknown>;
}
interface NodeResponse {
	writeHead(status: number, headers?: Record<string, string>): unknown;
	end(body?: string): unknown;
}

/** Exact route object shape `webServer.register` accepts. */
export interface WebRoute {
	kind: 'exact';
	path: string;
	handler: (req: unknown, res: unknown) => Promise<void>;
}

/**
 * The browser-side same-origin fence shipped plugins use: absent header
 * (non-browser callers) passes, cross-site is refused. The web server is
 * loopback-bound already; this stops a foreign page from riding the user's
 * session.
 */
function isSameOrigin(req: NodeRequest): boolean {
	const site = req.headers['sec-fetch-site'];
	const value = Array.isArray(site) ? site[0] : site;
	if (value === undefined) return true;
	return value === 'same-origin' || value === 'none';
}

async function readBody(req: NodeRequest): Promise<string> {
	let raw = '';
	for await (const chunk of req) raw += typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
	return raw;
}

/**
 * Build the exact route serving one endpoint.
 *
 * Protocol violations answer non-200 (fail loud at the transport layer);
 * endpoint errors answer 200 with an `ok:false` envelope the client helper
 * rejects — the same error contract the panel has always used.
 */
export function createRpcRoute(endpoint: string, handle: (endpoint: string, payload: unknown) => Promise<Record<string, unknown>>): WebRoute {
	const send = (res: NodeResponse, status: number, body: unknown): void => {
		res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
		res.end(JSON.stringify(body));
	};
	return {
		kind: 'exact',
		path: rpcHttpPath(endpoint),
		handler: async (rawReq: unknown, rawRes: unknown): Promise<void> => {
			const req = rawReq as NodeRequest;
			const res = rawRes as NodeResponse;
			if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
				res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
				res.end('method not allowed');
				return;
			}
			if (!isSameOrigin(req)) {
				res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
				res.end('forbidden');
				return;
			}
			const raw = await readBody(req);
			let payload: unknown = {};
			if (raw.trim() !== '') {
				try {
					payload = JSON.parse(raw);
				} catch {
					send(res, 400, rpcError('gateway/bad-request', 'body is not JSON'));
					return;
				}
			}
			try {
				send(res, 200, await handle(endpoint, payload));
			} catch (error) {
				send(res, 200, rpcError('internal', error instanceof Error ? error.message : String(error)));
			}
		}
	};
}
