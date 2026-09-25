/**
 * Incremental watermark scanner over the DSH sessions directory.
 *
 * Walks `<sessionsDir>/**\/session.v*.jsonl.zstd` (two real layouts exist:
 * `<slug>/<file>` and `<slug>/<sessionId>/<file>`). First sight of a file
 * parses it fully; later scans only decompress frames appended past the
 * watermark (sessions are append-only, frame-aligned) and continue line
 * parsing from the carried partial line. A file that shrank or moved is
 * re-parsed fully.
 *
 * The watermark carries per-file: consumed size, mtimeMs, the partial line,
 * the parsed session header (needed to type new rows without the file's
 * line 1) and the attempt-ordinal state — so an incremental scan produces
 * EXACTLY the records a full reparse would (invariant under test).
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { zstdDecompressAll, zstdDecompressRange } from './zstd.js';
import { parseSessionArchive, parseCallRows, type CallRecord, type SessionHeader } from './session-parse.js';

const ARCHIVE_PATTERN = /^session\.v\d+\.jsonl\.zstd$/;

interface FileWatermark {
	size: number;
	mtimeMs: number;
	remainder: string;
	header: SessionHeader;
	attemptState: Record<string, number>;
}

export interface WatermarkState {
	version: 1;
	files: Record<string, FileWatermark>;
	savedAt: number;
}

export interface ScanFileResult {
	file: string;
	sessionId: string;
	/** 'full' — records replace the session; 'append' — records extend it. */
	mode: 'full' | 'append';
	records: CallRecord[];
}

export interface ScanOutcome {
	results: ScanFileResult[];
	/** Session ids of EVERY archive seen this pass, unchanged files included. */
	sessionIds: Set<string>;
	/** Files that refused to parse, with the exact reason — surfaced, never swallowed. */
	errors: { file: string; error: string }[];
	durationMs: number;
}

/** Collect archive files recursively (both directory layouts). */
export async function listArchiveFiles(sessionsDir: string): Promise<string[]> {
	const found: string[] = [];
	async function walk(dir: string): Promise<void> {
		let entries;
		try {
			entries = await fsp.readdir(dir, { withFileTypes: true });
		} catch (e) {
			throw new Error(`cannot read sessions directory ${dir}: ${(e as Error).message}`);
		}
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.isFile() && ARCHIVE_PATTERN.test(entry.name)) found.push(full);
		}
	}
	await walk(sessionsDir);
	found.sort();
	return found;
}

async function readWatermark(watermarkPath: string): Promise<WatermarkState> {
	try {
		const raw = await fsp.readFile(watermarkPath, 'utf8');
		const parsed = JSON.parse(raw) as WatermarkState;
		if (parsed.version !== 1 || parsed.files === null || typeof parsed.files !== 'object') {
			throw new Error(`unsupported watermark schema (version=${JSON.stringify(parsed.version)})`);
		}
		return parsed;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, files: {}, savedAt: 0 };
		throw new Error(`cannot read watermark ${watermarkPath}: ${(e as Error).message}`);
	}
}

/** Write JSON atomically (tmp sibling + rename — dsh-atomic-write protocol, self-carried). */
export async function writeAtomicJson(target: string, value: unknown): Promise<void> {
	await fsp.mkdir(path.dirname(target), { recursive: true });
	const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(value), 'utf8');
	await fsp.rename(tmp, target);
}

export class SessionScanner {
	private readonly sessionsDir: string;
	private readonly watermarkPath: string;
	private state: WatermarkState | null = null;
	private seenSessionIds: Set<string> | null = null;

	constructor(sessionsDir: string, watermarkPath: string) {
		this.sessionsDir = sessionsDir;
		this.watermarkPath = watermarkPath;
	}

	/** One incremental scan pass. Per-file failures are collected in `errors`. */
	async scan(): Promise<ScanOutcome> {
		if (this.state === null) this.state = await readWatermark(this.watermarkPath);
		const started = Date.now();
		const results: ScanFileResult[] = [];
		const errors: { file: string; error: string }[] = [];
		const sessionIds = new Set<string>();
		this.seenSessionIds = sessionIds;
		const files = await listArchiveFiles(this.sessionsDir);
		const seen = new Set<string>();
		for (const file of files) {
			seen.add(file);
			try {
				const outcome = await this.scanFile(file);
				if (outcome !== null) results.push(outcome);
			} catch (e) {
				errors.push({ file, error: (e as Error).message });
				// A failed file must not keep a stale watermark: force full reparse next scan.
				delete this.state.files[file];
			}
		}
		// Drop watermarks of files that disappeared (session cleanup) so the state cannot grow unbounded.
		for (const key of Object.keys(this.state.files)) {
			if (!seen.has(key)) delete this.state.files[key];
		}
		this.state.savedAt = Date.now();
		await writeAtomicJson(this.watermarkPath, this.state);
		return { results, sessionIds, errors, durationMs: Date.now() - started };
	}

	/** Scan one file; null result when unchanged (watermark hit). */
	private async scanFile(file: string): Promise<ScanFileResult | null> {
		const stat = await fsp.stat(file);
		const wm = this.state!.files[file];
		if (wm !== undefined && wm.size === stat.size && wm.mtimeMs === stat.mtimeMs) {
			this.seenSessionIds!.add(wm.header.id);
			return null;
		}
		let records: CallRecord[];
		let header: SessionHeader;
		let remainder: string;
		let attemptState: Record<string, number>;
		let mode: 'full' | 'append';
		if (wm === undefined || stat.size < wm.size || stat.mtimeMs < wm.mtimeMs) {
			// first sight, truncated (rewritten), or older mtime: full parse
			const text = zstdDecompressAll(await fsp.readFile(file)).toString('utf8');
			const parsed = parseSessionArchive(text, file);
			header = parsed.header;
			records = parsed.calls;
			attemptState = parsed.attemptState;
			remainder = '';
			mode = 'full';
		} else {
			// append: decompress only frames past the watermark
			const buf = await fsp.readFile(file);
			const fresh = zstdDecompressRange(buf, wm.size, stat.size).toString('utf8');
			const combined = wm.remainder + fresh;
			const lines = combined.split('\n');
			const trailingPartial = lines.pop() ?? '';
			const rows: unknown[] = [];
			for (const line of lines) {
				if (line.length === 0) throw new Error(`${file}: blank line inside appended range is not a valid JSONL record`);
				rows.push(JSON.parse(line));
			}
			const attemptMap = new Map(Object.entries(wm.attemptState));
			records = parseCallRows(rows, wm.header, `${file} (+${wm.size}B)`, attemptMap);
			header = wm.header;
			attemptState = Object.fromEntries(attemptMap);
			remainder = trailingPartial;
			mode = 'append';
		}
		this.state!.files[file] = { size: stat.size, mtimeMs: stat.mtimeMs, remainder, header, attemptState };
		this.seenSessionIds!.add(header.id);
		return { file, sessionId: header.id, mode, records };
	}
}
