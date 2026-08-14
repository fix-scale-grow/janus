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
import { FieldCrew } from "./field-crew";

export const metadata: Metadata = {
	title: "Field",
};

export default function FieldPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Field</PageShellTitle>
					<PageShellDescription>
						Today&apos;s active jobs — call the customer, open the job.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Field />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Field() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(trpc.deals.fieldToday.queryOptions());

	return (
		<HydrateClient>
			<FieldCrew />
		</HydrateClient>
	);
}
