"use client";

import type { ViewTableId } from "@crm/db/user-views";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export type BoardDensity = "comfortable" | "compact";

export function useBoardDensity(tableId: ViewTableId, initial?: BoardDensity) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [density, setDensityState] = useState<BoardDensity>(
		initial ?? "comfortable",
	);
	const save = useMutation(trpc.views.save.mutationOptions());

	const setDensity = (next: BoardDensity) => {
		setDensityState(next);
		save.mutate(
			{ tableId, state: { density: next } },
			{ onSuccess: () => void cache.views(tableId, { settle: "record" }) },
		);
	};

	return { density, setDensity };
}
