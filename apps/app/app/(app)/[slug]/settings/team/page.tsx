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
import { CrewsTable } from "./crews-table";
import { membersSearchParams } from "./members-search-params";
import { MembersTable } from "./members-table";

export const metadata: Metadata = {
	title: "Team",
};

export default function TeamSettingsPage({
	searchParams,
}: PageProps<"/[slug]/settings/team">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Team</PageShellTitle>
					<PageShellDescription>
						Everyone in the business — who signs in, and the crews in the field.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Team searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Team({
	searchParams,
}: Pick<PageProps<"/[slug]/settings/team">, "searchParams">) {
	await requireSession();

	const values = await membersSearchParams.load(searchParams);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	const workspace = await queryClient.fetchQuery(
		trpc.workspace.get.queryOptions(),
	);

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.workspace.members.queryOptions(membersSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.crews.list.queryOptions()),
		workspace.viewerRole === "admin" || workspace.viewerRole === "owner"
			? queryClient.prefetchQuery(trpc.permissions.listUsers.queryOptions())
			: Promise.resolve(),
	]);

	return (
		<HydrateClient>
			<div className="flex flex-col gap-10">
				<section className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<h2 className="font-semibold text-base">Members</h2>
						<p className="text-muted-foreground text-sm">
							Everyone who has access to your CRM.
						</p>
					</div>
					<MembersTable />
				</section>

				<section className="flex max-w-4xl flex-col gap-4">
					<div className="flex flex-col gap-1">
						<h2 className="font-semibold text-base">Crews</h2>
						<p className="text-muted-foreground text-sm">
							Name your crews and give each a colour. Tasks on the project
							calendar take their crew's colour.
						</p>
					</div>
					<CrewsTable />
				</section>
			</div>
		</HydrateClient>
	);
}
