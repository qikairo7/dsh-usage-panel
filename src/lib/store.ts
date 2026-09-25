/**
 * Call-level detail store (G2 location: $DSH_HOME/dsh-usage-panel/).
 *
 * Persists every CallRecord keyed by session; aggregate views are DERIVED
 * from these rows at query time, so "detail sum == summary" is an invariant
 * by construction and every aggregate traces back to session files.
 * Writes are atomic (tmp sibling + rename — dsh-atomic-write protocol,
 * self-carried because link-installed plugins cannot resolve host packages).
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import type { CallRecord } from './session-parse.js';
import { writeAtomicJson } from './scanner.js';

interface StoreFile {
	version: 1;
	savedAt: number;
	sessions: Record<string, CallRecord[]>;
}

function isCallRecord(v: unknown): v is CallRecord {
	if (v === null || typeof v !== 'object') return false;
	const r = v as Record<string, unknown>;
	return (
		typeof r.sessionId === 'string' &&
		typeof r.sessionVersion === 'number' &&
		(r.origin === 'main' || r.origin === 'subagent') &&
		(r.parentSession === null || typeof r.parentSession === 'string') &&
		typeof r.delegationDepth === 'number' &&
		typeof r.ts === 'number' &&
		typeof r.seq === 'number' &&
		typeof r.turn === 'number' &&
		typeof r.step === 'number' &&
		typeof r.attempt === 'number' &&
		(r.provider === null || typeof r.provider === 'string') &&
		(r.model === null || typeof r.model === 'string') &&
		(r.messageId === null || typeof r.messageId === 'string') &&
		r.usage !== null &&
		typeof r.usage === 'object' &&
		typeof (r.usage as Record<string, unknown>).inputTokens === 'number' &&
		typeof (r.usage as Record<string, unknown>).totalTokens === 'number'
	);
}

export class UsageStore {
	private readonly storePath: string;
	private sessions = new Map<string, CallRecord[]>();
	private loaded = false;

	constructor(storePath: string) {
		this.storePath = storePath;
	}

	/** Load persisted state once (missing file = empty store, first run). */
	async load(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		let raw: string;
		try {
			raw = await fsp.readFile(this.storePath, 'utf8');
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw new Error(`cannot read usage store ${this.storePath}: ${(e as Error).message}`);
		}
		let parsed: StoreFile;
		try {
			parsed = JSON.parse(raw) as StoreFile;
		} catch (e) {
			throw new Error(`usage store ${this.storePath} is not valid JSON: ${(e as Error).message}`);
		}
		if (parsed.version !== 1 || parsed.sessions === null || typeof parsed.sessions !== 'object') {
			throw new Error(`usage store ${this.storePath}: unsupported schema (version=${JSON.stringify((parsed as { version?: unknown }).version)})`);
		}
		for (const [sessionId, records] of Object.entries(parsed.sessions)) {
			if (!Array.isArray(records)) {
				throw new Error(`usage store ${this.storePath}: sessions[${JSON.stringify(sessionId)}] is not an array`);
			}
			for (const r of records) {
				if (!isCallRecord(r)) {
					throw new Error(`usage store ${this.storePath}: sessions[${JSON.stringify(sessionId)}] contains a malformed record (seq=${JSON.stringify((r as { seq?: unknown }).seq)})`);
				}
			}
			this.sessions.set(sessionId, records);
		}
	}

	/** Replace one session's records (full reparse). */
	replaceSession(sessionId: string, records: CallRecord[]): void {
		this.sessions.set(sessionId, records.slice().sort((a, b) => a.seq - b.seq));
	}

	/** Extend one session with appended records, deduped by seq (idempotent replays). */
	appendSession(sessionId: string, records: CallRecord[]): void {
		const existing = this.sessions.get(sessionId) ?? [];
		const bySeq = new Map(existing.map((r) => [r.seq, r]));
		for (const r of records) bySeq.set(r.seq, r);
		this.sessions.set(sessionId, [...bySeq.values()].sort((a, b) => a.seq - b.seq));
	}

	/** Drop sessions no longer present on disk (removed archives). */
	dropMissing(sessionIds: Set<string>): void {
		for (const key of this.sessions.keys()) {
			if (!sessionIds.has(key)) this.sessions.delete(key);
		}
	}

	async save(): Promise<void> {
		const file: StoreFile = {
			version: 1,
			savedAt: Date.now(),
			sessions: Object.fromEntries(this.sessions)
		};
		await writeAtomicJson(this.storePath, file);
	}

	/** All records across sessions (unsorted snapshot). */
	allRecords(): CallRecord[] {
		const out: CallRecord[] = [];
		for (const records of this.sessions.values()) out.push(...records);
		return out;
	}

	sessionCount(): number {
		return this.sessions.size;
	}

	recordCount(): number {
		let n = 0;
		for (const records of this.sessions.values()) n += records.length;
		return n;
	}

	/** Store location for diagnostics. */
	get path(): string {
		return path.normalize(this.storePath);
	}
}
