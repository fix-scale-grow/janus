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
import { SymbolsTable } from "./symbols-table";

export const metadata: Metadata = {
	title: "Symbols",
};

export default function SymbolsSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Symbols</PageShellTitle>
					<PageShellDescription>
						The shapes a drawing's symbol palette can place, and the service
						each one prices against.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Symbols />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Symbols() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.symbols.list.queryOptions({
				q: "",
				sort: "name",
				dir: "asc",
				page: 1,
				pageSize: 100,
			}),
		),
		queryClient.prefetchQuery(
			trpc.services.list.queryOptions({
				q: "",
				sort: "name",
				dir: "asc",
				page: 1,
				pageSize: 100,
				active: true,
			}),
		),
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-4xl flex-col gap-6">
				<SymbolsTable />
			</div>
		</HydrateClient>
	);
}
