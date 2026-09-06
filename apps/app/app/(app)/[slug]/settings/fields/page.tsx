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
import { FieldsSettings } from "./fields-settings";

export const metadata: Metadata = {
	title: "Fields",
};

export default function FieldsSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Fields</PageShellTitle>
					<PageShellDescription>
						The details Janus keeps on every contact and job — yours to define.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Fields />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Fields() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(
		trpc.fields.list.queryOptions({ entity: "CONTACT", includeArchived: true }),
	);
	await queryClient.prefetchQuery(
		trpc.fields.list.queryOptions({ entity: "DEAL", includeArchived: true }),
	);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<FieldsSettings />
			</div>
		</HydrateClient>
	);
}
