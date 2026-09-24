/**
 * Real-corpus smoke: run the full service against the REAL DSH_HOME sessions
 * directory (read-only) and print one summary line. Reproduces the numbers in
 * reports/g2-g3-g4-evidence.md. Usage: npm run smoke (equivalently
 * node --import ./tests/ts-alias.mjs scripts/smoke-corpus.mjs — the bare
 * `node scripts/smoke-corpus.mjs` form cannot resolve the .js→.ts alias)
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUsageService } from '../src/server/usage-service.ts';

const sessionsDir = process.env.DSH_HOME ? path.join(process.env.DSH_HOME, 'sessions') : 'D:/dsh-data/sessions';
const dataDir = mkdtempSync(path.join(tmpdir(), 'usage-smoke-'));
const svc = createUsageService({ sessionsDir, ledgerPath: null, refreshMs: 60000, dataDir, priceSnapshotPath: './data/prices.snapshot.json' });
const s = await svc.summary('all');
const r = await svc.refresh({ prices: false });
const today = await svc.summary('today');
const byModel = await svc.breakdown('all', 'model');
console.log(JSON.stringify({
	scanMs: r.durationMs,
	files: r.rescannedFiles,
	scanErrorCount: r.scanErrors?.length ?? 0,
	firstScanErrors: (r.scanErrors ?? []).slice(0, 3).map((e) => e.error.slice(0, 120)),
	sessions: s.sessions,
	calls: s.calls,
	tokensM: Math.round((s.tokens.total / 1e6) * 100) / 100,
	cacheHitRate: Math.round(s.cacheHitRate * 1000) / 1000,
	mainCalls: s.mainSub.main.calls,
	subCalls: s.mainSub.subagent.calls,
	todayCalls: today.calls,
	todayTokens: today.tokens.total,
	models: byModel.slice(0, 5).map((m) => ({ model: m.model, calls: m.calls }))
}, null, 1));
