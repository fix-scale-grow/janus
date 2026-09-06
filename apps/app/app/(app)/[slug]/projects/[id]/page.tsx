import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell, PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ProjectBoard } from "./project-board";
import { ProjectHeader } from "./project-header";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedProject params={params} />
		</Suspense>
	);
}

async function PrefetchedProject({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	const [{ id }] = await Promise.all([params, requireSession()]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(trpc.projects.byId.queryOptions({ id })),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	const project = queryClient.getQueryData(trpc.projects.byId.queryKey({ id }));
	if (!project) notFound();

	return (
		<PageShell className="min-h-0" contained>
			<HydrateClient>
				<ProjectHeader id={id} />
				<ProjectBoard id={id} />
			</HydrateClient>
		</PageShell>
	);
}
