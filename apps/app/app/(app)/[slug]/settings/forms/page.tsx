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
import { PAGE_DESCRIPTION, PAGE_TITLE } from "./forms-copy";
import { FormsSettings } from "./forms-table";

export const metadata: Metadata = {
	title: PAGE_TITLE,
};

const LIST_INPUT = {
	q: "",
	sort: "updatedAt",
	dir: "desc" as const,
	page: 1,
	pageSize: 100,
};

export default function FormsSettingsPage() {
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
					<Forms />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Forms() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.forms.list.queryOptions(LIST_INPUT));
	await queryClient.prefetchQuery(
		trpc.fields.list.queryOptions({
			entity: "CONTACT",
			includeArchived: false,
		}),
	);

	return (
		<HydrateClient>
			<div className="flex max-w-5xl flex-col gap-6">
				<FormsSettings />
			</div>
		</HydrateClient>
	);
}
