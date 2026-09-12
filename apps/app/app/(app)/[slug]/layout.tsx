import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { AppIconRail, AppIconRailFallback } from "@/components/app-icon-rail";
import { QuickSwitcher } from "@/components/crm/quick-switcher";
import { RecordSheetHost } from "@/components/crm/record-sheet/record-sheet-host";
import { MobileNavProvider } from "@/components/mobile-nav";
import { readInstallNavLayout } from "@/lib/nav-layout";
import { requireMailboxAccess } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export default async function AppLayout({
	children,
	params,
}: LayoutProps<"/[slug]">) {
	const navLayout = await readInstallNavLayout();

	return (
		<MobileNavProvider>
			<div className="isolate flex h-svh flex-col">
				<Suspense fallback={<AppHeaderFallback />}>
					<WorkspaceHeader params={params} navLayout={navLayout} />
				</Suspense>

				<div className="flex min-h-0 flex-1">
					<Suspense fallback={<AppIconRailFallback navLayout={navLayout} />}>
						<AppRail navLayout={navLayout} />
					</Suspense>
					{children}
				</div>

				<Suspense fallback={null}>
					<RecordSheetHost />
				</Suspense>

				<Suspense fallback={null}>
					<QuickSwitcher />
				</Suspense>
			</div>
		</MobileNavProvider>
	);
}

async function AppRail({ navLayout }: { navLayout: "RAIL" | "TOP_BAR" }) {
	await connection();
	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	const [permissions, navView] = await Promise.all([
		queryClient.fetchQuery(trpc.permissions.mine.queryOptions()),
		queryClient.fetchQuery(trpc.views.get.queryOptions({ tableId: "nav" })),
		queryClient.prefetchQuery(
			trpc.views.get.queryOptions({ tableId: "dashboard" }),
		),
	]);

	return (
		<HydrateClient>
			<AppIconRail
				navLayout={navLayout}
				initialPermissionKeys={permissions.keys}
				initialNavOrder={navView?.navOrder}
				initialNavHidden={navView?.navHidden}
			/>
		</HydrateClient>
	);
}

async function WorkspaceHeader({
	params,
	navLayout,
}: Pick<LayoutProps<"/[slug]">, "params"> & {
	navLayout: "RAIL" | "TOP_BAR";
}) {
	await connection();
	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	const workspacePromise = queryClient
		.fetchQuery(trpc.workspace.get.queryOptions())
		.catch((error: unknown) => {
			unstable_rethrow(error);
			return null;
		});
	const permissionsPromise = queryClient.fetchQuery(
		trpc.permissions.mine.queryOptions(),
	);
	const navViewPromise = queryClient.fetchQuery(
		trpc.views.get.queryOptions({ tableId: "nav" }),
	);
	const [{ user }, { slug }, workspace, permissions, navView] =
		await Promise.all([
			requireMailboxAccess(),
			params,
			workspacePromise,
			permissionsPromise,
			navViewPromise,
		]);

	if (workspace && workspace.slug !== slug) notFound();

	return (
		<HydrateClient>
			<AppHeader
				user={{
					name: user.name,
					email: user.email,
					image: user.image ?? null,
				}}
				navLayout={navLayout}
				initialPermissionKeys={permissions.keys}
				initialNavOrder={navView?.navOrder}
				initialNavHidden={navView?.navHidden}
			/>
		</HydrateClient>
	);
}
