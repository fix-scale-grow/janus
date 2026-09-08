"use client";

import type { ViewTableId } from "@crm/db/user-views";
import type { DataTableStickyView } from "@crm/ui/components/data-table";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function useViewSync(tableId: ViewTableId, clearSticky: () => void) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();

	const save = useMutation(trpc.views.save.mutationOptions());
	const reset = useMutation(trpc.views.reset.mutationOptions());

	const onViewChange = useCallback(
		(view: DataTableStickyView) => {
			save.mutate(
				{ tableId, state: view },
				{ onSuccess: () => void cache.views(tableId, { settle: "record" }) },
			);
		},
		[save.mutate, tableId, cache],
	);

	const onReset = useCallback(() => {
		clearSticky();
		reset.mutate(
			{ tableId },
			{
				onSuccess: () => {
					void cache.views(tableId, { settle: "record" });
					router.refresh();
				},
			},
		);
	}, [reset.mutate, tableId, cache, router, clearSticky]);

	return { onViewChange, onReset };
}
