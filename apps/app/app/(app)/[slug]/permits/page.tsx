import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
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
import { loadPermitsSearchParams } from "./permits-search-params";
import { PermitsTable } from "./permits-table";

export const metadata: Metadata = {
	title: "Permits",
};

export default function PermitsPage({
	searchParams,
}: PageProps<"/[slug]/permits">) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Permits</PageShellTitle>
					<PageShellDescription>
						Every permit pulled for a job, from application to close.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Permits searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Permits({
	searchParams,
}: Pick<PageProps<"/[slug]/permits">, "searchParams">) {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const { permitStatus } = await loadPermitsSearchParams(searchParams);

	await queryClient.prefetchQuery(
		trpc.permits.list.queryOptions({
			status: permitStatus === "all" ? undefined : permitStatus,
			page: 1,
		}),
	);

	return (
		<HydrateClient>
			<PermitsTable />
		</HydrateClient>
	);
}
