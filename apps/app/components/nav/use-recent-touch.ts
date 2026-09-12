"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export type RecentTouchKind =
	| "estimate"
	| "invoice"
	| "contract"
	| "drawing"
	| "project";

export function useRecentTouch(kind: RecentTouchKind, recordId: string): void {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const fired = useRef(false);

	const touch = useMutation(
		trpc.recents.touch.mutationOptions({
			onSuccess: () => void cache.recents(),
			onError: () => {},
		}),
	);
	const touchRef = useRef(touch.mutate);
	touchRef.current = touch.mutate;

	useEffect(() => {
		if (fired.current) return;
		fired.current = true;
		touchRef.current({ kind, recordId });
	}, [kind, recordId]);
}
