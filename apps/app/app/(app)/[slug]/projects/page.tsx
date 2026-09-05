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
import {
	type ProjectStatusFilter,
	projectsSearchParams,
} from "./projects-search-params";
import { ProjectsTable } from "./projects-table";

export const metadata: Metadata = {
	title: "Projects",
};

export default function ProjectsPage({
	searchParams,
}: PageProps<"/[slug]/projects">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Projects</PageShellTitle>
					<PageShellDescription>
						Every job site, organised by days, pointed at a goal.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Projects searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Projects({
	searchParams,
}: Pick<PageProps<"/[slug]/projects">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		projectsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const input = projectsSearchParams.toInput(values);
	const status = input.status as ProjectStatusFilter;
	await queryClient.prefetchQuery(
		trpc.projects.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
	);

	return (
		<HydrateClient>
			<ProjectsTable />
		</HydrateClient>
	);
}
