import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import {
	getServerQueryClient,
	getServerTrpc,
	getServerTrpcClient,
} from "@/lib/trpc/server";
import { CrewsTable } from "./crews-table";
import { GroupsPanel } from "./groups-panel";
import { membersSearchParams } from "./members-search-params";
import { MembersTable } from "./members-table";
import { TeamTabs } from "./team-tabs";

export const metadata: Metadata = {
	title: "Team",
};

export default function TeamSettingsPage({
	params,
	searchParams,
}: PageProps<"/[slug]/settings/team">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Team</PageShellTitle>
					<PageShellDescription>
						Who signs in to the CRM, and the crews out in the field.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Team params={params} searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Team({
	params,
	searchParams,
}: Pick<PageProps<"/[slug]/settings/team">, "params" | "searchParams">) {
	await requireSession();

	const { slug } = await params;

	const client = getServerTrpcClient();
	const mine = await client.permissions.mine.query();
	if (!mine.isAdmin) redirect(`/${slug}`);

	const values = await membersSearchParams.load(searchParams);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.fetchQuery(trpc.workspace.get.queryOptions());

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.workspace.members.queryOptions(membersSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.crews.list.queryOptions()),
		queryClient.prefetchQuery(trpc.accessGroups.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<TeamTabs
				crews={
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
				}
				groups={<GroupsPanel />}
				members={
					<section className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<h2 className="font-semibold text-base">Members</h2>
							<p className="text-muted-foreground text-sm">
								Everyone who has access to your CRM.
							</p>
						</div>
						<MembersTable />
					</section>
				}
			/>
		</HydrateClient>
	);
}
