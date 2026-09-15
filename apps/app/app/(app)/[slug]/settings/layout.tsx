import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PATHNAME_HEADER } from "@/lib/pathname-header";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { SettingsSidebar, SettingsSidebarFallback } from "./settings-sidebar";

const PER_USER_SETTINGS_PATHS = ["/settings/navigation"];

export default async function SettingsLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}>) {
	const { slug } = await params;
	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	const mine = await queryClient
		.fetchQuery(trpc.permissions.mine.queryOptions())
		.catch(() => undefined);

	if (mine && !mine.isAdmin) {
		const headerList = await headers();
		const pathname = headerList.get(PATHNAME_HEADER);
		const settingsPath = pathname?.slice(`/${slug}`.length) ?? "";
		const isPerUser = PER_USER_SETTINGS_PATHS.some(
			(path) => settingsPath === path || settingsPath.startsWith(`${path}/`),
		);

		if (!isPerUser) redirect(`/${slug}`);
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
			<Suspense fallback={<SettingsSidebarFallback />}>
				<SettingsSidebar />
			</Suspense>
			{children}
		</div>
	);
}
