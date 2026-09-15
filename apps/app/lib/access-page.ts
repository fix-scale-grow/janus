import "server-only";
import { notFound, unstable_rethrow } from "next/navigation";
import { moduleHidden } from "@/lib/access-rules";
import { JANUS_LIVE_NAV } from "@/lib/janus-nav";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export async function requireModuleView(href: string): Promise<void> {
	const mine = await getServerQueryClient()
		.fetchQuery(getServerTrpc().permissions.mine.queryOptions())
		.catch((error: unknown) => {
			unstable_rethrow(error);
			return null;
		});
	if (mine && moduleHidden(mine, href, JANUS_LIVE_NAV)) notFound();
}
