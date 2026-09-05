"use client";

import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useRef,
} from "react";

type PanState = { pointerId: number; startX: number; startLeft: number };

export function usePanScroll<T extends HTMLElement>() {
	const ref = useRef<T | null>(null);
	const pan = useRef<PanState | null>(null);

	const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
		const container = ref.current;
		if (!container || event.button !== 0) return;
		if (!(event.target instanceof Element)) return;
		if (event.target.closest("[data-board-drag]")) return;
		if (event.target.closest("a, button, input, textarea, select")) return;
		event.preventDefault();
		pan.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startLeft: container.scrollLeft,
		};
		container.setPointerCapture(event.pointerId);
	}, []);

	const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
		const container = ref.current;
		const state = pan.current;
		if (!container || !state || event.pointerId !== state.pointerId) return;
		container.scrollLeft = state.startLeft - (event.clientX - state.startX);
	}, []);

	const endPan = useCallback((event: ReactPointerEvent<T>) => {
		const container = ref.current;
		const state = pan.current;
		if (!container || !state || event.pointerId !== state.pointerId) return;
		pan.current = null;
		if (container.hasPointerCapture(event.pointerId)) {
			container.releasePointerCapture(event.pointerId);
		}
	}, []);

	return {
		ref,
		handlers: {
			onPointerDown,
			onPointerMove,
			onPointerUp: endPan,
			onPointerCancel: endPan,
		},
	};
}
