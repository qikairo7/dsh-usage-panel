/**
 * Session archive line parser — turns decompressed JSONL into call records.
 *
 * Field shapes verified against real archives (reports/g2-g3-g4-evidence.md):
 *   line     = {type, seq, time(epoch ms), data}
 *   header   = {type:'session', version:3|4, id, createdAt, cwd, isSeeded,
 *               delegationDepth, agentPreset, [parentSession, origin:'subagent']}
 *   usage row = {type:'assistant/message', data:{turn, step, message:{role,
 *               content, source:{kind:'model', provider, model, …}, id},
 *               usage:{inputTokens, outputTokens, totalTokens,
 *               cacheReadTokens[, cacheWriteTokens]}, stream}}
 *
 * Session ids appear both as `session-<uuid>` and bare `<uuid>` — never
 * parse the id, treat it as an opaque key.
 *
 * Retries: every attempt emits its own assistant/message row with its own
 * usage (llm/retry-started {retryId, turn, step, retry} precedes reattempts),
 * so counting rows counts attempts once each — never folded, never deduped.
 * Rows sharing (turn, step) get an incrementing `attempt` ordinal.
 */
import type { PriceTiers } from './types.js';

/** Raw usage counters as stored in session files (SPEC §2 canonical names). */
export interface Usage {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
}

// PriceTiers is re-exported for the pricing module's per-tier arithmetic.
export type { PriceTiers };

/** One billable LLM call extracted from a session archive. */
export interface CallRecord {
	sessionId: string;
	sessionVersion: number;
	origin: 'main' | 'subagent';
	parentSession: string | null;
	delegationDepth: number;
	ts: number;
	seq: number;
	turn: number;
	step: number;
	/** 1-based ordinal among assistant/message rows sharing (turn, step). */
	attempt: number;
	provider: string | null;
	model: string | null;
	messageId: string | null;
	usage: Usage;
}

/** Parsed session header (line 0). */
export interface SessionHeader {
	version: number;
	id: string;
	origin: 'main' | 'subagent';
	parentSession: string | null;
	delegationDepth: number;
}

function isFiniteNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate the session header object (IO boundary). Throws with the
 * offending field; no silent defaults.
 */
export function parseSessionHeader(raw: unknown, at: string): SessionHeader {
	if (raw === null || typeof raw !== 'object') throw new Error(`${at}: header is not an object`);
	const h = raw as Record<string, unknown>;
	if (h.type !== 'session') throw new Error(`${at}: first line type=${JSON.stringify(h.type)}, expected "session"`);
	if (h.version !== 3 && h.version !== 4) {
		throw new Error(`${at}: unsupported session version ${JSON.stringify(h.version)} (supported: 3, 4)`);
	}
	if (typeof h.id !== 'string' || h.id.length === 0) throw new Error(`${at}: header.id must be a non-empty string`);
	if (h.origin === undefined) {
		// main session
	} else if (h.origin !== 'subagent') {
		throw new Error(`${at}: header.origin must be "subagent" when present, got ${JSON.stringify(h.origin)}`);
	}
	if (h.parentSession !== undefined && typeof h.parentSession !== 'string') {
		throw new Error(`${at}: header.parentSession must be a string when present`);
	}
	if (!isFiniteNumber(h.delegationDepth)) throw new Error(`${at}: header.delegationDepth must be a number`);
	return {
		version: h.version,
		id: h.id,
		origin: h.origin === 'subagent' ? 'subagent' : 'main',
		parentSession: typeof h.parentSession === 'string' ? h.parentSession : null,
		delegationDepth: h.delegationDepth
	};
}

function parseUsage(raw: unknown, at: string): Usage {
	if (raw === null || typeof raw !== 'object') throw new Error(`${at}: usage is not an object`);
	const u = raw as Record<string, unknown>;
	// input/output are the billing foundation — missing or non-numeric refuses the row.
	for (const key of ['inputTokens', 'outputTokens'] as const) {
		if (!isFiniteNumber(u[key])) {
			throw new Error(`${at}.usage.${key}: expected a finite number, got ${JSON.stringify(u[key])}`);
		}
	}
	// cache counters did not exist in older archive versions (v3-era rows carry
	// only input/output/total): absence means "not tracked" ⇒ 0; a present but
	// non-numeric value refuses the row.
	const optional = (key: string): number => {
		const v = u[key];
		if (v === undefined) return 0;
		if (!isFiniteNumber(v)) throw new Error(`${at}.usage.${key}: expected a finite number, got ${JSON.stringify(v)}`);
		return v;
	};
	const cacheRead = optional('cacheReadTokens');
	const cacheWrite = optional('cacheWriteTokens');
	const input = u.inputTokens as number;
	const output = u.outputTokens as number;
	let total: number;
	if (u.totalTokens === undefined) {
		total = input + output + cacheRead + cacheWrite;
	} else if (isFiniteNumber(u.totalTokens)) {
		total = u.totalTokens as number;
	} else {
		throw new Error(`${at}.usage.totalTokens: expected a finite number, got ${JSON.stringify(u.totalTokens)}`);
	}
	return { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, totalTokens: total };
}

/**
 * Parse decompressed JSONL text into call records. Malformed JSON or
 * malformed usage throws with the line number — a session archive this
 * build cannot faithfully interpret is refused, never misread.
 */
export function parseSessionArchive(text: string, at: string): { header: SessionHeader; calls: CallRecord[]; attemptState: Record<string, number> } {
	const lines = text.split('\n');
	// tolerate a trailing newline after the last record; any other blank line is malformed
	const rows: unknown[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.length === 0) {
			if (i === lines.length - 1) break;
			throw new Error(`${at}: blank line at ${i + 1} is not a valid JSONL record`);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (e) {
			throw new Error(`${at}: line ${i + 1} is not valid JSON: ${(e as Error).message}`);
		}
		rows.push(parsed);
	}
	if (rows.length === 0) throw new Error(`${at}: archive has no records`);
	const header = parseSessionHeader(rows[0], `${at}: line 1`);
	const attemptState = new Map<string, number>();
	const calls = parseCallRows(rows.slice(1), header, `${at}`, attemptState);
	return { header, calls, attemptState: Object.fromEntries(attemptState) };
}

/**
 * Parse assistant/message rows (line objects already JSON-parsed) against a
 * known header — the incremental-scanning entry point. `attemptState` carries
 * the per-(turn,step) attempt ordinals across scans so that incremental
 * parsing yields exactly the same ordinals as a full reparse.
 */
export function parseCallRows(rows: readonly unknown[], header: SessionHeader, at: string, attemptState = new Map<string, number>()): CallRecord[] {
	const calls: CallRecord[] = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i] as Record<string, unknown>;
		if (row.type !== 'assistant/message') continue;
		const lineAt = `${at}: row ${i + 1}`;
		if (!isFiniteNumber(row.seq)) throw new Error(`${lineAt}: seq must be a number`);
		if (!isFiniteNumber(row.time)) throw new Error(`${lineAt}: time must be a number`);
		const data = row.data;
		if (data === null || typeof data !== 'object') throw new Error(`${lineAt}: data is not an object`);
		const d = data as Record<string, unknown>;
		if (!isFiniteNumber(d.turn)) throw new Error(`${lineAt}: data.turn must be a number`);
		if (!isFiniteNumber(d.step)) throw new Error(`${lineAt}: data.step must be a number`);
		if (d.usage === undefined) continue; // assistant row without usage = non-billed emission (e.g. stream placeholder)
		const usage = parseUsage(d.usage, lineAt);
		const msg = d.message;
		let provider: string | null = null;
		let model: string | null = null;
		let messageId: string | null = null;
		if (msg !== null && typeof msg === 'object') {
			const m = msg as Record<string, unknown>;
			const source = m.source;
			if (source !== null && typeof source === 'object') {
				const s = source as Record<string, unknown>;
				if (s.provider !== undefined && typeof s.provider !== 'string') {
					throw new Error(`${lineAt}: message.source.provider must be a string when present`);
				}
				if (s.model !== undefined && typeof s.model !== 'string') {
					throw new Error(`${lineAt}: message.source.model must be a string when present`);
				}
				provider = typeof s.provider === 'string' ? s.provider : null;
				model = typeof s.model === 'string' ? s.model : null;
			}
			if (m.id !== undefined && typeof m.id !== 'string') {
				throw new Error(`${lineAt}: message.id must be a string when present`);
			}
			messageId = typeof m.id === 'string' ? m.id : null;
		}
		const key = `${d.turn}/${d.step}`;
		const attempt = (attemptState.get(key) ?? 0) + 1;
		attemptState.set(key, attempt);
		calls.push({
			sessionId: header.id,
			sessionVersion: header.version,
			origin: header.origin,
			parentSession: header.parentSession,
			delegationDepth: header.delegationDepth,
			ts: row.time,
			seq: row.seq,
			turn: d.turn,
			step: d.step,
			attempt,
			provider,
			model,
			messageId,
			usage
		});
	}
	return calls;
}
