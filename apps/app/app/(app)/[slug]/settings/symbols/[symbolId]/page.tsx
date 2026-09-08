import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { SymbolEditor } from "./symbol-editor";

export const metadata: Metadata = {
	title: "Symbol",
};

export default function SymbolEditorPage({
	params,
}: {
	params: Promise<{ slug: string; symbolId: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedSymbolEditor params={params} />
		</Suspense>
	);
}

async function PrefetchedSymbolEditor({
	params,
}: {
	params: Promise<{ slug: string; symbolId: string }>;
}) {
	const [{ symbolId }] = await Promise.all([params, requireSession()]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const isNew = symbolId === "new";

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.services.list.queryOptions({ active: true, pageSize: 100 }),
		),
		isNew
			? Promise.resolve()
			: queryClient.prefetchQuery(
					trpc.symbols.byId.queryOptions({ id: symbolId }),
				),
	]);

	if (!isNew) {
		const symbol = queryClient.getQueryData(
			trpc.symbols.byId.queryKey({ id: symbolId }),
		);
		if (!symbol) notFound();
	}

	return (
		<HydrateClient>
			<SymbolEditor key={symbolId} symbolId={symbolId} />
		</HydrateClient>
	);
}
