import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import {
	getServerQueryClient,
	getServerTrpc,
	getServerTrpcClient,
} from "@/lib/trpc/server";
import { ReportsTabs } from "./reports-tabs";

const PROFIT_VIEW_KEY = "profit.view";

export const metadata: Metadata = {
	title: "Reports",
};

export default function ReportsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Reports</PageShellTitle>
					<PageShellDescription>
						Where the money went — by client, by month, by cost type.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Reports />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Reports() {
	await requireSession();

	const client = getServerTrpcClient();
	const mine = await client.permissions.mine.query();
	if (!mine.keys.includes(PROFIT_VIEW_KEY)) notFound();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.reports.byClient.queryOptions()),
		queryClient.prefetchQuery(trpc.reports.byMonth.queryOptions()),
		queryClient.prefetchQuery(trpc.reports.byCategory.queryOptions({})),
	]);

	return (
		<HydrateClient>
			<ReportsTabs />
		</HydrateClient>
	);
}
