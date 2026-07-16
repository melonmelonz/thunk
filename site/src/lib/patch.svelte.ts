// The launchpad tracker as a runes store, persisted to localStorage
// `thunk.patch.v1`. Pure logic (the stage machine, the shape, the template) lives
// in patch.ts; this file is the reactive, side-effecting wrapper - the same
// pattern as xp.svelte.ts. It holds ONLY the learner's own notes about one real
// patch, in this browser. Nothing is ever sent anywhere; the real work happens on
// the sites the launchpad links out to.
//
// The one cross-store coupling: reaching MERGED grants the `merged` achievement
// on the XP store (the existing quiet toast, no confetti). That is self-reported
// - the tracker is the learner's word that it landed.

import { browser } from '$app/environment';
import { xp } from './xp.svelte';
import {
	newPatchState,
	isValidPatchState,
	isMerged,
	nextStage,
	prevStage,
	stageIndex,
	PATCH_KEY,
	type PatchState,
	type Stage
} from './patch';

class PatchStore {
	state = $state<PatchState>(newPatchState());
	#loaded = false;

	// Loaded on mount from the /first-patch page (like the XP store), so the
	// prerendered HTML renders the empty tracker and the client's first render
	// matches before the persisted record fills in.
	hydrate(): void {
		this.#load();
	}
	#ensureLoaded(): void {
		if (!this.#loaded) this.#load();
	}

	// ---- Reactive readouts --------------------------------------------------
	get stage(): Stage {
		return this.state.stage;
	}
	get index(): number {
		return stageIndex(this.state.stage);
	}
	get merged(): boolean {
		return isMerged(this.state.stage);
	}
	isChecked(id: string): boolean {
		return !!this.state.checklist[id];
	}

	// ---- Mutators -----------------------------------------------------------
	setProject(v: string): void {
		this.#ensureLoaded();
		this.state.project = v;
		this.#touch();
	}
	setIssue(v: string): void {
		this.#ensureLoaded();
		this.state.issueUrl = v;
		this.#touch();
	}
	toggleCheck(id: string): void {
		this.#ensureLoaded();
		this.state.checklist = { ...this.state.checklist, [id]: !this.state.checklist[id] };
		this.#touch();
	}

	advance(): void {
		this.#ensureLoaded();
		this.#moveTo(nextStage(this.state.stage));
	}
	retreat(): void {
		this.#ensureLoaded();
		this.#moveTo(prevStage(this.state.stage));
	}
	/** Jump straight to a stage (the stepper's dots are clickable). */
	setStage(stage: Stage): void {
		this.#ensureLoaded();
		this.#moveTo(stage);
	}

	// Any transition that ARRIVES at MERGED fires the achievement once. Retreating
	// away never un-grants it - a merge is public and permanent; the badge is too.
	#moveTo(stage: Stage): void {
		if (this.state.stage === stage) return;
		this.state.stage = stage;
		this.#touch();
		if (isMerged(stage)) xp.grantMerged();
	}

	// ---- Persistence + transfer ---------------------------------------------
	#touch(): void {
		this.state.updatedAt = Date.now();
		this.#persist();
	}
	#load(): void {
		if (this.#loaded || !browser) return;
		this.#loaded = true;
		try {
			const raw = localStorage.getItem(PATCH_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (isValidPatchState(parsed)) this.state = { ...newPatchState(), ...parsed };
		} catch {
			// corrupt or denied: start clean, never throw into a render.
		}
	}
	#persist(): void {
		if (!browser) return;
		try {
			localStorage.setItem(PATCH_KEY, JSON.stringify(this.state));
		} catch {
			// storage denied (private mode): the tracker still works in-session.
		}
	}

	/** The whole tracker as pretty JSON, for the EXPORT affordance. */
	exportJson(): string {
		return JSON.stringify(this.state, null, 2);
	}

	/** Import a previously exported tracker. Rejects anything not v1-shaped. */
	importJson(text: string): { ok: boolean; error?: string } {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return { ok: false, error: 'not valid JSON' };
		}
		if (!isValidPatchState(parsed)) return { ok: false, error: 'not a thunk.patch.v1 record' };
		this.state = { ...newPatchState(), ...(parsed as PatchState) };
		this.#persist();
		if (this.merged) xp.grantMerged();
		return { ok: true };
	}

	/** Clear the tracker (the UI gates this behind a confirm). */
	reset(): void {
		this.state = newPatchState();
		this.#persist();
	}
}

export const patch = new PatchStore();
