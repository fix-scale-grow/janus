import { US_STATES } from "@crm/db/settings";
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
import { PAGE_DESCRIPTION, PAGE_TITLE } from "./permits-copy";
import { PermitsSettings } from "./permits-settings";

export const metadata: Metadata = {
	title: PAGE_TITLE,
};

export default function PermitsSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{PAGE_TITLE}</PageShellTitle>
					<PageShellDescription>{PAGE_DESCRIPTION}</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Permits />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Permits() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.settings.permits.queryOptions()),
		queryClient.prefetchQuery(trpc.permissions.mine.queryOptions()),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
		queryClient.prefetchQuery(
			trpc.pipelines.list.queryOptions({ includeArchived: false }),
		),
		queryClient.prefetchQuery(trpc.permits.jurisdictions.queryOptions()),
		queryClient.prefetchQuery(trpc.permits.lockerList.queryOptions()),
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<PermitsSettings states={[...US_STATES]} />
			</div>
		</HydrateClient>
	);
}
