"use client";

import { useRef } from "react";

/** Blocks a second submit before React has re-rendered the disabled button.
 * A dblclick's two click events land in the same task, ahead of the paint
 * that would show `mutation.isPending`, so `disabled={mutation.isPending}`
 * alone lets both through. This ref flips synchronously on the first call,
 * closing that window; `release` clears it once the mutation settles. */
export function useSubmitGuard() {
	const pending = useRef(false);

	function guard(run: () => void) {
		if (pending.current) return;
		pending.current = true;
		run();
	}

	function release() {
		pending.current = false;
	}

	return { guard, release };
}
