// Perf budget gate (spec 7): the first route must ship under 100 KB of JS,
// gzipped, before the wasm bench ever loads. A prerendered HTML page lists the
// exact client chunks it needs (module scripts + modulepreload); this sums their
// gzip sizes and fails the build if the entry route crosses the budget.
//
// Usage:  node scripts/perf-budget.mjs [buildDir] [budgetKB]
// CI wires it after `npm run build`. wasm is excluded on purpose - it is a lazy
// chunk fetched only on /bench, never in a route's initial graph.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(here, '..', process.argv[2] || 'build');
const BUDGET = (Number(process.argv[3]) || 100) * 1024;

// The routes whose initial JS graph we care about. The index is the enforced
// first route; the others are reported for context (a lesson pulls the check +
// XP code, the heaviest content route short of the bench).
const ROUTES = [
	{ name: '/ (index)', html: 'index.html', enforce: true },
	{ name: '/m/../.. (lesson)', html: 'm/m0-power-on/01-the-machine/index.html', enforce: false },
	{ name: '/bench', html: 'bench/index.html', enforce: false }
];

function jsFor(htmlPath) {
	const full = resolve(buildDir, htmlPath);
	if (!existsSync(full)) return null;
	const html = readFileSync(full, 'utf8');
	const refs = new Set();
	for (const m of html.matchAll(/_app\/immutable\/[A-Za-z0-9_/.-]+\.js/g)) refs.add(m[0]);
	let total = 0;
	for (const ref of refs) {
		const f = resolve(buildDir, ref);
		if (existsSync(f)) total += gzipSync(readFileSync(f)).length;
	}
	return { count: refs.size, gz: total };
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
let failed = false;

console.log(`perf budget: entry JS gz must be < ${kb(BUDGET)}\n`);
for (const route of ROUTES) {
	const r = jsFor(route.html);
	if (!r) {
		if (route.enforce) {
			console.error(`  MISSING  ${route.name}  (${route.html} not found)`);
			failed = true;
		}
		continue;
	}
	const over = route.enforce && r.gz > BUDGET;
	const mark = over ? 'OVER  ' : route.enforce ? 'OK    ' : '      ';
	console.log(`  ${mark} ${route.name.padEnd(20)} ${kb(r.gz).padStart(9)}  (${r.count} chunks)`);
	if (over) failed = true;
}

if (failed) {
	console.error('\nperf budget FAILED: first-route JS exceeds the budget.');
	process.exit(1);
}
console.log('\nperf budget OK.');
