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
import { CrewsTable } from "./crews-table";

export const metadata: Metadata = {
	title: "Crews",
};

export default function CrewsSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Crews</PageShellTitle>
					<PageShellDescription>
						Name your crews and give each a colour. Tasks on the project
						calendar take their crew's colour.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Crews />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Crews() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.crews.list.queryOptions());

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<CrewsTable />
			</div>
		</HydrateClient>
	);
}
