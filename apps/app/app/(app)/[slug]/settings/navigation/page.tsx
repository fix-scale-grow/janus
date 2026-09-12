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
import { NavigationForm } from "./navigation-form";

export const metadata: Metadata = {
	title: "Navigation",
};

export default function NavigationSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Navigation</PageShellTitle>
					<PageShellDescription>
						How the sidebar lays out and what shows in it.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Settings />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Settings() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.permissions.mine.queryOptions()),
		queryClient.prefetchQuery(trpc.views.get.queryOptions({ tableId: "nav" })),
		queryClient.prefetchQuery(
			trpc.pipelines.list.queryOptions({ includeArchived: false }),
		),
		queryClient.prefetchQuery(trpc.settings.navLayout.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.dealNumbering.queryOptions()),
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<NavigationForm />
			</div>
		</HydrateClient>
	);
}
