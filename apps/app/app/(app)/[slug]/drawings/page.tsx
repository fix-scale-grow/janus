import type { Metadata } from "next";
import { Suspense } from "react";
import { DrawingGrid } from "@/components/drawings/drawing-grid";
import { NewDrawingMenu } from "@/components/drawings/new-drawing-menu";
import {
	PageShell,
	PageShellActions,
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
import {
	type DrawingAttachment,
	drawingsSearchParams,
} from "./drawings-search-params";

export const metadata: Metadata = {
	title: "Drawings",
};

export default function DrawingsPage({
	searchParams,
}: PageProps<"/[slug]/drawings">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Drawings</PageShellTitle>
					<PageShellDescription>
						Site sketches, measured and marked up.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<NewDrawingMenu />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Drawings searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Drawings({
	searchParams,
}: Pick<PageProps<"/[slug]/drawings">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		drawingsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const input = drawingsSearchParams.toInput(values);
	await queryClient.prefetchQuery(
		trpc.drawings.list.queryOptions({
			...input,
			attachment: input.attachment as DrawingAttachment,
		}),
	);

	return (
		<HydrateClient>
			<DrawingGrid />
		</HydrateClient>
	);
}
