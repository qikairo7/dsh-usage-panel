/**
 * Build: compile src/*.ts into lib/ (tsc, declarations included), then
 * copy the vendored runtime files (schemastery.mjs + cosmokit.js) into
 * lib/vendor/ so the compiled lib/index.js relative import resolves.
 * Declaration files stay in src/ — they are for type-checking only.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('tsc -p tsconfig.json', { stdio: 'inherit' });
mkdirSync('lib/vendor', { recursive: true });
for (const file of readdirSync('src/vendor')) {
	if (file.endsWith('.d.mts') || file.endsWith('.d.ts')) continue;
	cpSync(`src/vendor/${file}`, `lib/vendor/${file}`);
}
// The DSH web host loads /plugins/<pkg>/client.js as a CLASSIC <script>, not
// an ES module: any top-level import/export statement is a SyntaxError there
// ("Unexpected token 'export'"). tsc emits a vacuous `export {};` because
// client.ts counts as a module — strip that marker, but fail loudly on any
// REAL ESM statement: the bundle must stay a self-contained classic script.
{
	const clientPath = 'lib/client.js';
	const src = readFileSync(clientPath, 'utf8');
	const esm = [...src.matchAll(/^(?:import|export)\b[^\n]*$/gm)].map((m) => m[0].trim());
	const real = esm.filter((s) => s !== 'export {};');
	if (real.length > 0) {
		throw new Error(`build: lib/client.js contains real ESM statements (${real.length}); the classic-script loader would fail: ${JSON.stringify(real)}`);
	}
	if (esm.length > 0) {
		writeFileSync(clientPath, src.replace(/^export \{\};[ \t]*\r?\n?/m, ''), 'utf8');
		console.log(`build: stripped ${esm.length} vacuous ESM marker(s) from lib/client.js (classic-script safe)`);
	}
}
console.log('build: tsc ok, lib/vendor populated');