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
import {
	type EstimateStatusFilter,
	estimatesSearchParams,
} from "./estimates-search-params";
import { EstimatesTable } from "./estimates-table";
import { NewEstimateButton } from "./new-estimate-button";

export const metadata: Metadata = {
	title: "Estimates",
};

export default function EstimatesPage({
	searchParams,
}: PageProps<"/[slug]/estimates">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Estimates</PageShellTitle>
					<PageShellDescription>
						What you have priced for the customer, good/better/best.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<NewEstimateButton />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Estimates searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Estimates({
	searchParams,
}: Pick<PageProps<"/[slug]/estimates">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		estimatesSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const input = estimatesSearchParams.toInput(values);
	const status = input.status as EstimateStatusFilter;
	await queryClient.prefetchQuery(
		trpc.estimates.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
	);

	return (
		<HydrateClient>
			<EstimatesTable />
		</HydrateClient>
	);
}
