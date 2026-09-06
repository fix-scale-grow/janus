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
import { TEMPLATE_PURPOSE_ORDER } from "@/components/templates/template-labels";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { TemplatesTable } from "./templates-table";

export const metadata: Metadata = {
	title: "Templates",
};

export default function TemplatesSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Templates</PageShellTitle>
					<PageShellDescription>
						The email and contract wording sent to a contact, by purpose.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Templates />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Templates() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	for (const purpose of TEMPLATE_PURPOSE_ORDER) {
		await queryClient.fetchQuery(
			trpc.templates.byPurpose.queryOptions({ purpose }),
		);
	}

	await queryClient.prefetchQuery(trpc.templates.list.queryOptions());

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<TemplatesTable />
			</div>
		</HydrateClient>
	);
}
