/**
 * Scaffold smoke test: the copied tree must be the usage panel, not the
 * quota fork, and the files the build depends on must exist.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(pkg.name, 'dsh-usage-panel', 'package name must be dsh-usage-panel');
assert.ok(pkg.scripts.check.includes('lint') && pkg.scripts.check.includes('test') && pkg.scripts.check.includes('build'), 'check chain must be lint && test && build');
assert.match(pkg.scripts.check, /&&/, 'check chain must short-circuit with &&');
for (const f of ['src/index.ts', 'src/client.ts', 'src/vendor/schemastery.mjs', 'scripts/build.mjs', 'data/prices.snapshot.json', 'cordis.patch.yml']) {
	assert.ok(existsSync(path.join(root, f)), `required file missing: ${f}`);
}
const patch = readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8');
assert.ok(patch.includes('dsh-usage-panel'), 'bundle patch must mount dsh-usage-panel');
assert.ok(!patch.includes('quota'), 'bundle patch must not reference quota-panel');
