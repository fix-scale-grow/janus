import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell, PageShellLoading } from "@/components/page-shell";
import { requireModuleView } from "@/lib/access-page";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ProposalEditor } from "./proposal-editor";

export const metadata: Metadata = {
	title: "Proposal",
};

export default function ProposalPage({
	params,
}: PageProps<"/[slug]/estimates/[estimateId]/proposal">) {
	return (
		<PageShell className="min-h-0">
			<Suspense fallback={<PageShellLoading />}>
				<Proposal params={params} />
			</Suspense>
		</PageShell>
	);
}

async function Proposal({
	params,
}: Pick<PageProps<"/[slug]/estimates/[estimateId]/proposal">, "params">) {
	const [, { estimateId }] = await Promise.all([
		requireSession(),
		params,
		requireModuleView("/estimates"),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.proposals.forEstimate.queryOptions({ estimateId }),
		),
		queryClient.prefetchQuery(
			trpc.estimates.byId.queryOptions({ id: estimateId }),
		),
		queryClient.prefetchQuery(trpc.proposals.mailerConfigured.queryOptions()),
	]);

	return (
		<HydrateClient>
			<ProposalEditor estimateId={estimateId} />
		</HydrateClient>
	);
}
