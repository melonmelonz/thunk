// Build-time provenance for the footer build plate. Writes src/lib/build.json
// with the real git short sha and the workspace test count. Runs as a prebuild
// (and predev) step so the CI site job and local builds both stamp truth. When
// git is absent the sha falls back to "dev"; when the Rust crates are not on
// disk the test count is omitted (null) rather than invented. Never fake values.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const out = resolve(here, '..', 'src', 'lib', 'build.json');

function shortSha() {
	try {
		return execFileSync('git', ['-C', repoRoot, 'rev-parse', '--short', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	} catch {
		return 'dev';
	}
}

// Count the workspace tests the way `cargo test --workspace` (default profile)
// does: every #[test] / #[tokio::test], minus the ones gated behind the `open`
// feature (which build only under --features open). A static scan, so it needs
// no compile and stays hermetic. Returns null if the crates are not present.
const CRATES = [
	'thunk-cli',
	'thunk-content',
	'thunk-core',
	'thunk-hw',
	'thunk-sim',
	'thunk-tui',
	'thunk-web'
];
const TEST_ATTR = /#\[(?:tokio::)?test\]/;
const OPEN_GATE = /cfg\(\s*feature\s*=\s*"open"\s*\)/;

function walkRs(dir, acc) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return acc;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			if (e.name === 'target' || e.name === 'node_modules') continue;
			walkRs(p, acc);
		} else if (e.name.endsWith('.rs')) {
			acc.push(p);
		}
	}
	return acc;
}

function testCount() {
	let present = false;
	let count = 0;
	for (const crate of CRATES) {
		const dir = join(repoRoot, crate);
		try {
			if (!statSync(dir).isDirectory()) continue;
		} catch {
			continue;
		}
		present = true;
		for (const file of walkRs(dir, [])) {
			const lines = readFileSync(file, 'utf8').split('\n');
			for (let i = 0; i < lines.length; i++) {
				if (!TEST_ATTR.test(lines[i])) continue;
				// Skip tests carrying an `open`-feature gate on the same item
				// (the attribute sits within a few lines above the #[test]).
				let gated = false;
				for (let j = i; j >= Math.max(0, i - 6); j--) {
					if (OPEN_GATE.test(lines[j])) {
						gated = true;
						break;
					}
					if (j < i && /^\s*(async\s+)?fn\s/.test(lines[j])) break;
				}
				if (!gated) count++;
			}
		}
	}
	return present ? count : null;
}

const info = { sha: shortSha(), tests: testCount(), airgapped: true };
writeFileSync(out, JSON.stringify(info, null, '\t') + '\n');
process.stderr.write(
	`build-info: sha=${info.sha} tests=${info.tests ?? 'n/a'} -> ${out}\n`
);
