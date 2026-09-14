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
import { ReportCards } from "./report-cards";

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
						A library of canned reports, built from the data you already have.
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

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.permissions.mine.queryOptions());

	return (
		<HydrateClient>
			<ReportCards />
		</HydrateClient>
	);
}
