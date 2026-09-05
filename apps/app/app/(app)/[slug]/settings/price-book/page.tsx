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
import { PriceBookTable } from "./price-book-table";

export const metadata: Metadata = {
	title: "Price book",
};

export default function PriceBookSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Price book</PageShellTitle>
					<PageShellDescription>
						What you charge for each service, by the square, the linear foot,
						the each, or flat.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<PriceBook />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function PriceBook() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(
		trpc.services.list.queryOptions({
			q: "",
			sort: "name",
			dir: "asc",
			page: 1,
			pageSize: 100,
		}),
	);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<PriceBookTable />
			</div>
		</HydrateClient>
	);
}
