/**
 * usage_query tool regression + host-contract mirror.
 *
 * Two bugs this file exists to prevent:
 *
 *  1. (acceptance fix f0214c50) single-sided since/until bounds must shape an
 *     OPEN range — never fall back to 'all' and silently drop the bound.
 *     Fixture: one 2020 call + one today call; a since=today-midnight query
 *     must return ONLY the today call.
 *
 *  2. (live outage, root cause in the host log) the first release registered
 *     usage_query WITHOUT the mandatory `output` declaration. The real
 *     dsh-tools registry throws
 *         TypeError: tool "usage_query" must declare output { schema, render, presentationMeta? }
 *     and because apply() is one synchronous fiber body, the throw aborted the
 *     route mounting that followed — every browser request fell through to the
 *     SPA fallback and the panel reported 启动失败. The old fake ctx here
 *     accepted any definition, so the tests passed while the live host failed.
 *     The fake below now enforces the real register() contract (mirrored from
 *     dsh-tools/lib/index.js:2878-2890 and its schema-subset validator), and a
 *     dedicated test pins the mount-before-tools ordering.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { apply } = await import('../src/index.ts');

// ---------------------------------------------------------------------------
// Host-contract mirror: the subset of JSON Schema dsh-tools accepts, plus the
// register() precondition. Deliberately strict — a permissive fake is what let
// the outage through.
// ---------------------------------------------------------------------------

const CONSTRAINT_KEYWORDS = new Set(['type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const']);
const ANNOTATION_KEYWORDS = new Set(['description', 'title', 'default', 'examples']);
const ONE_OF_SIBLING_KEYWORDS = ['properties', 'required', 'additionalProperties', 'items', 'enum', 'const'];
const SCHEMA_TYPES = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];

function isPlainRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSupportedJsonSchema(schema) {
	const violations = [];
	const walk = (node, at) => {
		if (!isPlainRecord(node)) {
			violations.push(`${at} must be a schema object`);
			return;
		}
		for (const key of Object.keys(node)) {
			if (CONSTRAINT_KEYWORDS.has(key) || ANNOTATION_KEYWORDS.has(key)) continue;
			violations.push(`${at}.${key} is not a supported keyword`);
		}
		const hasType = Object.hasOwn(node, 'type');
		const hasOneOf = Object.hasOwn(node, 'oneOf');
		if (hasType && hasOneOf) {
			violations.push(`${at} cannot declare both type and oneOf`);
			return;
		}
		if (!hasType && !hasOneOf) {
			for (const key of ONE_OF_SIBLING_KEYWORDS) {
				if (Object.hasOwn(node, key)) violations.push(`${at}.${key} requires type or oneOf`);
			}
			return;
		}
		if (hasOneOf) {
			for (const key of ONE_OF_SIBLING_KEYWORDS) {
				if (Object.hasOwn(node, key)) violations.push(`${at}.${key} is not supported beside oneOf`);
			}
			if (!Array.isArray(node.oneOf) || node.oneOf.length === 0) violations.push(`${at}.oneOf must be a non-empty array`);
			else node.oneOf.forEach((branch, i) => walk(branch, `${at}.oneOf[${i}]`));
			return;
		}
		if (!SCHEMA_TYPES.includes(node.type)) violations.push(`${at}.type is not a supported JSON Schema type`);
		if (Object.hasOwn(node, 'required')) {
			if (!Array.isArray(node.required) || node.required.some((entry) => typeof entry !== 'string')) {
				violations.push(`${at}.required must be an array of strings`);
			} else {
				const declared = isPlainRecord(node.properties) ? node.properties : {};
				for (const key of node.required) {
					if (!Object.hasOwn(declared, key)) violations.push(`${at}.required names "${key}" which is not in properties`);
				}
			}
		}
		if (Object.hasOwn(node, 'additionalProperties') && typeof node.additionalProperties !== 'boolean') {
			violations.push(`${at}.additionalProperties must be a boolean`);
		}
		if (isPlainRecord(node.properties)) {
			for (const [key, child] of Object.entries(node.properties)) walk(child, `${at}.properties.${key}`);
		}
		if (Object.hasOwn(node, 'items')) walk(node.items, `${at}.items`);
	};
	walk(schema, 'schema');
	if (violations.length > 0) throw new Error(`JsonSchemaError: ${violations.join('; ')}`);
}

/** The real register(): validate output, validate its schema, keep the definition. */
function registerTool(sink, definition) {
	const name = definition.name;
	const output = definition.output;
	if (output === undefined || typeof output !== 'object' || typeof output.render !== 'function') {
		throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
	}
	assertSupportedJsonSchema(output.schema);
	sink.push(definition);
	return () => {};
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function archiveOf(rows) {
	return Buffer.concat(rows.map((r) => zlib.zstdCompressSync(Buffer.from(JSON.stringify(r) + '\n', 'utf8'))));
}
const header = (id) => ({ type: 'session', version: 4, id, createdAt: 1, delegationDepth: 0 });
const usageRow = (seq, time) => ({
	type: 'assistant/message', seq, time,
	data: { turn: 1, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15 } }
});

function makeEnv(t) {
	const root = mkdtempSync(path.join(tmpdir(), 'usage-query-'));
	const sessionsDir = path.join(root, 'sessions');
	const dataDir = path.join(root, 'data');
	const dir = path.join(sessionsDir, 'slug', 'session-qq');
	mkdirSync(dir, { recursive: true });
	mkdirSync(dataDir, { recursive: true });
	const snapshotPath = path.join(root, 'prices.json');
	writeFileSync(snapshotPath, JSON.stringify({ schemaVersion: 1, source: 'test', fetchedAt: 1, subscriptionShadowMap: {}, channelUnitPricesCny: {}, models: [] }), 'utf8');
	// One call in 2020, one call NOW (real data never lies in the future, and
	// the since-only range ends at now — a future-dated sample would fall
	// outside it no matter how correct the tool is).
	const nowTs = Date.now();
	writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), archiveOf([
		header('session-qq'),
		usageRow(2, Date.UTC(2020, 5, 15, 10, 0, 0)),
		usageRow(3, nowTs)
	]));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return { sessionsDir, dataDir, snapshotPath };
}

/**
 * Mount the plugin against a ctx whose tools.register enforces the real host
 * contract. Returns the registered tool plus the route paths that were mounted.
 */
function captureTool(env, toolsOverride) {
	const tools = [];
	const routes = [];
	const ctx = {
		tools: toolsOverride ?? { register: (definition) => registerTool(tools, definition) },
		// The host Context carries cordis `effect` plus the synchronous service
		// lookup `get`; the fake mirrors both so apply() mounts its web routes
		// the way the shipped web app does (`ctx.get('webServer')`).
		effect: (callback) => { const disposer = callback(); return typeof disposer === 'function' ? disposer : () => {}; },
		get: (name) => (name === 'webServer' ? { register: (route) => { routes.push(route.path); return () => {}; } } : undefined)
	};
	apply(ctx, { refreshMs: 60000, sessionsDir: env.sessionsDir, dataDir: env.dataDir, priceSnapshotPath: env.snapshotPath });
	return { tool: tools[0], routes };
}

/** Execute through the same path the host uses: validate value, then render. */
async function run(tool, args) {
	const value = await tool.execute(args, {});
	assertSupportedJsonSchema(tool.output.schema);
	const rendered = tool.output.render(args, value);
	assert.ok(Array.isArray(rendered) && rendered.length > 0, 'output.render must return at least one content block');
	assert.ok(rendered.every((block) => block !== null && typeof block === 'object' && typeof block.type === 'string'), 'render blocks must be typed content blocks');
	return value.result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('usage_query: since-only shapes [since, now) — today call only, 2020 call excluded', async () => {
	const env = makeEnv(test);
	const { tool } = captureTool(env);
	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);
	const result = await run(tool, { group_by: 'summary', since: midnight.toISOString() });
	assert.equal(result.calls, 1, 'only the today call is inside [since, now)');
	assert.equal(result.tokens.input, 10);
});

test('usage_query: until-only shapes [epoch, until) — 2020 call only when until is yesterday', async () => {
	const env = makeEnv(test);
	const { tool } = captureTool(env);
	const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
	const result = await run(tool, { group_by: 'summary', until: yesterday.toISOString() });
	assert.equal(result.calls, 1, 'only the 2020 call is inside [epoch, until)');
	assert.equal(result.tokens.input, 10);
});

test('usage_query: no bounds still returns the whole history', async () => {
	const env = makeEnv(test);
	const { tool } = captureTool(env);
	const result = await run(tool, { group_by: 'summary' });
	assert.equal(result.calls, 2);
});

test('usage_query: every group_by the schema advertises is executable and renderable', async () => {
	const env = makeEnv(test);
	const { tool } = captureTool(env);
	const advertised = tool.parameters.properties.group_by.enum;
	assert.deepEqual(
		[...advertised].sort(),
		['day', 'model', 'origin', 'provider', 'session', 'summary'],
		'the advertised enum is the contract the model plans against'
	);
	for (const groupBy of advertised) {
		const result = await run(tool, { group_by: groupBy });
		assert.ok(result !== undefined && result !== null, `group_by=${groupBy} must produce a payload`);
	}
});

test('usage_query: an unknown group_by is refused, never answered with a wrong shape', async () => {
	const env = makeEnv(test);
	const { tool } = captureTool(env);
	await assert.rejects(
		() => tool.execute({ group_by: 'nope' }, {}),
		/group_by must be one of summary\|day\|model\|provider\|session\|origin/,
		'Anti-Postel: reject and say which value is bad'
	);
});

test('registration contract: a broken tool definition throws instead of silently degrading', async () => {
	const env = makeEnv(test);
	// Regression for the live outage: this is the exact host error. If the
	// plugin ever drops `output` again, this fires here rather than in the host log.
	assert.throws(
		() => captureTool(env, { register: (definition) => registerTool([], { ...definition, output: undefined }) }),
		/must declare output \{ schema, render, presentationMeta\? \}/
	);
});

test('ordering: a throwing tools.register still leaves every data route mounted', async () => {
	const env = makeEnv(test);
	const routes = [];
	const ctx = {
		tools: { register: () => { throw new TypeError('tool "usage_query" must declare output { schema, render, presentationMeta? }'); } },
		effect: (callback) => { const disposer = callback(); return typeof disposer === 'function' ? disposer : () => {}; },
		get: (name) => (name === 'webServer' ? { register: (route) => { routes.push(route.path); return () => {}; } } : undefined)
	};
	assert.throws(() => apply(ctx, { refreshMs: 60000, sessionsDir: env.sessionsDir, dataDir: env.dataDir, priceSnapshotPath: env.snapshotPath }), /must declare output/);
	// The browser half must already be live: a tool-contract break is an agent
	// -tool problem, it must never take the panel's data endpoints down with it.
	assert.deepEqual(routes, [
		'/usage-panel/api/summary',
		'/usage-panel/api/timeseries',
		'/usage-panel/api/breakdown',
		'/usage-panel/api/detail',
		'/usage-panel/api/pricing',
		'/usage-panel/api/refresh',
		'/usage-panel/api/ledger'
	]);
});
