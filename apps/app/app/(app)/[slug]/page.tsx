import { Suspense } from "react";
import { CustomiseControls } from "@/components/dashboard/customise-controls";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
} from "@/components/page-shell";
import { DashboardEditProvider } from "@/lib/dashboard/dashboard-edit-context";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { DashboardSummary } from "./dashboard-summary";
import {
	OverviewGreeting,
	OverviewGreetingFallback,
} from "./overview-greeting";
import {
	OverviewScopeToggle,
	OverviewScopeToggleFallback,
} from "./overview-scope";
import { loadOverviewSearchParams } from "./overview-search-params";

export default function OverviewPage({ searchParams }: PageProps<"/[slug]">) {
	return (
		<PageShell>
			<DashboardEditProvider>
				<PageShellHeader>
					<PageShellHeading>
						<Suspense fallback={<OverviewGreetingFallback />}>
							<OverviewGreeting />
						</Suspense>
					</PageShellHeading>
					<PageShellActions>
						<Suspense fallback={<OverviewScopeToggleFallback />}>
							<OverviewScopeToggle />
						</Suspense>
						<CustomiseControls />
					</PageShellActions>
				</PageShellHeader>

				<PageShellContent>
					<Suspense fallback={<PageShellLoading />}>
						<Summary searchParams={searchParams} />
					</Suspense>
				</PageShellContent>
			</DashboardEditProvider>
		</PageShell>
	);
}

async function Summary({
	searchParams,
}: Pick<PageProps<"/[slug]">, "searchParams">) {
	const [, { scope }] = await Promise.all([
		requireSession(),
		loadOverviewSearchParams(searchParams),
	]);

	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	await Promise.all([
		queryClient.prefetchQuery(trpc.dashboard.summary.queryOptions({ scope })),
		queryClient.prefetchQuery(
			trpc.views.get.queryOptions({ tableId: "dashboard" }),
		),
	]);

	return (
		<HydrateClient>
			<DashboardSummary />
		</HydrateClient>
	);
}
