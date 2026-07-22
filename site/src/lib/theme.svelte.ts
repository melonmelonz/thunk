// Theme: dark (the instrument face, default) or light (a paper/datasheet read of
// the same face). One reactive flag, mirrored onto <html data-theme> and
// persisted. The no-FOUC boot script in app.html sets the attribute before
// first paint; this store just keeps the runtime toggle and the attribute in
// sync after hydration.
const KEY = 'thunk.theme';
type Theme = 'dark' | 'light';

function read(): Theme {
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'light' || v === 'dark') return v;
	} catch {
		// storage denied
	}
	return 'dark';
}

function apply(t: Theme) {
	try {
		document.documentElement.dataset.theme = t;
	} catch {
		// no document (SSR): the boot script handles first paint
	}
}

class ThemeStore {
	current = $state<Theme>('dark');

	hydrate() {
		this.current = read();
		apply(this.current);
	}

	set(t: Theme) {
		this.current = t;
		apply(t);
		try {
			localStorage.setItem(KEY, t);
		} catch {
			// storage denied: won't persist across reloads, still applies now
		}
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeStore();
