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
import { PAGE_DESCRIPTION, PAGE_TITLE } from "./pipeline-copy";
import { PipelineSettings } from "./pipeline-settings";

export const metadata: Metadata = {
	title: PAGE_TITLE,
};

export default function PipelineSettingsPage() {
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
					<Pipeline />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Pipeline() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: true }),
	);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<PipelineSettings />
			</div>
		</HydrateClient>
	);
}
