/**
 * web-router ledger reader — SPEC §5 / WS1 conclusions.
 *
 * Default probe (config-overridable, never a hard-coded dead path):
 *   `<os home>/.agents/skills/web-router/route-ledger.jsonl`
 * Missing file ⇒ { available:false } empty state, never a throw. A corrupt
 * line DOES throw loud with file + line number (refuse, don't misread).
 * `recordType === 'meta'` rows are excluded from statistics. Sibling files
 * (traces/unverified) are deliberately not read.
 */
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LedgerChannelRow, LedgerResult } from './types.js';

/** Default ledger location per WS1 (probe order: config > os-home default). */
export function defaultLedgerPath(): string {
	return path.join(os.homedir(), '.agents', 'skills', 'web-router', 'route-ledger.jsonl');
}

const COST_TYPES = new Set(['free', 'paid', 'quota']);

interface LedgerRow {
	recordType?: unknown;
	ts?: unknown;
	channel?: unknown;
	cost?: unknown;
}

/**
 * Read and aggregate the ledger.
 * @param configuredPath config override; when null the default path is probed.
 * @param channelUnitPricesCny CNY-per-call unit prices (from the price snapshot); missing channels price 0.
 */
export async function readLedger(configuredPath: string | null, channelUnitPricesCny: Record<string, number>): Promise<LedgerResult> {
	const file = configuredPath !== null && configuredPath.length > 0 ? configuredPath : defaultLedgerPath();
	let raw: string;
	try {
		raw = await fsp.readFile(file, 'utf8');
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			return { available: false, path: file, byChannel: [], derivedCny: 0 };
		}
		throw new Error(`cannot read ledger ${file}: ${(e as Error).message}`);
	}
	const agg = new Map<string, { channel: string; costType: LedgerChannelRow['costType']; counts: number; lastTs: number | null }>();
	const lines = raw.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.length === 0) {
			if (i === lines.length - 1) break;
			continue; // ledger rows may be separated by blank lines written between batches
		}
		let row: LedgerRow;
		try {
			row = JSON.parse(line) as LedgerRow;
		} catch (e) {
			throw new Error(`ledger ${file}: line ${i + 1} is not valid JSON: ${(e as Error).message}`);
		}
		if (row.recordType === 'meta') continue;
		if (typeof row.channel !== 'string' || row.channel.length === 0) {
			throw new Error(`ledger ${file}: line ${i + 1} decision row has no channel`);
		}
		if (typeof row.cost !== 'string' || !COST_TYPES.has(row.cost)) {
			throw new Error(`ledger ${file}: line ${i + 1} cost must be one of free|paid|quota, got ${JSON.stringify(row.cost)}`);
		}
		// Real route-ledger rows carry ts as an ISO-8601 string (WS1 schema);
		// numeric epoch forms are honored too. Unparseable => null, never a guess.
		const rawTs = row.ts;
		let ts: number | null;
		if (typeof rawTs === 'number' && Number.isFinite(rawTs)) ts = rawTs;
		else if (typeof rawTs === 'string' && !Number.isNaN(Date.parse(rawTs))) ts = Date.parse(rawTs);
		else ts = null;
		const key = `${row.channel}${row.cost}`;
		const prev = agg.get(key);
		if (prev === undefined) {
			agg.set(key, { channel: row.channel, costType: row.cost as LedgerChannelRow['costType'], counts: 1, lastTs: ts });
		} else {
			prev.counts += 1;
			if (ts !== null && (prev.lastTs === null || ts > prev.lastTs)) prev.lastTs = ts;
		}
	}
	const byChannel = [...agg.values()].sort((a, b) => (a.channel < b.channel ? -1 : a.channel > b.channel ? 1 : a.costType < b.costType ? -1 : 1));
	let derivedCny = 0;
	for (const row of byChannel) {
		const unit = channelUnitPricesCny[row.channel];
		if (unit !== undefined) derivedCny += unit * row.counts;
	}
	return { available: true, path: file, byChannel, derivedCny };
}
