import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CreateDealSheet } from "./create-deal-sheet";
import { dealsSearchParams } from "./deals-search-params";
import { DealsView, DealsViewSwitch } from "./deals-view";

export const metadata: Metadata = {
	title: "Deals",
};

export default function DealsPage({
	searchParams,
}: PageProps<"/[slug]/deals">) {
	return (
		<PageShell className="min-h-0" contained>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Deals</PageShellTitle>
					<PageShellDescription>
						The pipeline, and everything that has already closed.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<DealsViewSwitch />
						<CreateDealSheet />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Deals searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Deals({
	searchParams,
}: Pick<PageProps<"/[slug]/deals">, "searchParams">) {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const savedState = await queryClient.fetchQuery(
		trpc.views.get.queryOptions({ tableId: "deals" }),
	);
	const params = dealsSearchParams(savedState ?? undefined);
	const values = await params.load(searchParams);

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.deals.list.queryOptions(params.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<DealsView savedState={savedState ?? undefined} />
		</HydrateClient>
	);
}
