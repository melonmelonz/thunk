// The widget registry: the id in a lesson's `:::widget <id>` directive mapped to
// a lazy loader for its Svelte component. Each entry is a dynamic import(), so a
// widget is a code-split chunk fetched only when a lesson that embeds it mounts -
// widgets never touch the first-route JS budget.
//
// Single source of truth: these ids must match `thunk_content::WIDGET_IDS` (the
// content suite pins that no lesson references an id outside that set). The
// renderer emits a static <figcaption> fallback for each, so a lesson still
// reads if a chunk fails to load or JS is off.

import type { Component } from 'svelte';

type WidgetModule = { default: Component<Record<string, unknown>> };

export const widgetRegistry: Record<string, () => Promise<WidgetModule>> = {
	'spi-scope': () => import('./SpiScope.svelte') as Promise<WidgetModule>,
	'bit-lab': () => import('./BitLab.svelte') as Promise<WidgetModule>,
	'byte-decoder': () => import('./ByteDecoder.svelte') as Promise<WidgetModule>,
	'volatile-memory': () => import('./VolatileMemory.svelte') as Promise<WidgetModule>,
	'ownership-move': () => import('./OwnershipMove.svelte') as Promise<WidgetModule>
};

/** The loader for a widget id, or undefined for an id the site cannot render. */
export function widgetLoader(id: string): (() => Promise<WidgetModule>) | undefined {
	return widgetRegistry[id];
}
