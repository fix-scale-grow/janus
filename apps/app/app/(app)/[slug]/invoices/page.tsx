import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
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
	type InvoiceStatusFilter,
	invoicesSearchParams,
} from "./invoices-search-params";
import { InvoicesTable } from "./invoices-table";
import { NewInvoiceButton } from "./new-invoice-button";

export const metadata: Metadata = {
	title: "Invoices",
};

export default function InvoicesPage({
	searchParams,
}: PageProps<"/[slug]/invoices">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Invoices</PageShellTitle>
					<PageShellDescription>
						What you have billed the customer, and what is still owed.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<NewInvoiceButton />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Invoices searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Invoices({
	searchParams,
}: Pick<PageProps<"/[slug]/invoices">, "searchParams">) {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const savedState = await queryClient.fetchQuery(
		trpc.views.get.queryOptions({ tableId: "invoices" }),
	);
	const params = invoicesSearchParams(savedState ?? undefined);
	const values = await params.load(searchParams);
	const input = params.toInput(values);
	const status = input.status as InvoiceStatusFilter;
	await queryClient.prefetchQuery(
		trpc.invoices.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
	);

	return (
		<HydrateClient>
			<InvoicesTable savedState={savedState ?? undefined} />
		</HydrateClient>
	);
}
