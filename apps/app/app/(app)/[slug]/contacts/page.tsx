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
import { contactsSearchParams } from "./contacts-search-params";
import { ContactsTable } from "./contacts-table";
import { CreateContactSheet } from "./create-contact-sheet";

export const metadata: Metadata = {
	title: "Contacts",
};

export default function ContactsPage({
	searchParams,
}: PageProps<"/[slug]/contacts">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Contacts</PageShellTitle>
					<PageShellDescription>Everyone in the pipeline.</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<CreateContactSheet />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Contacts searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Contacts({
	searchParams,
}: Pick<PageProps<"/[slug]/contacts">, "searchParams">) {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const [savedState] = await Promise.all([
		queryClient.fetchQuery(
			trpc.views.get.queryOptions({ tableId: "contacts" }),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);
	const params = contactsSearchParams(savedState ?? undefined);
	const values = await params.load(searchParams);

	await queryClient.prefetchQuery(
		trpc.contacts.list.queryOptions(params.toInput(values)),
	);

	return (
		<HydrateClient>
			<ContactsTable savedState={savedState ?? undefined} />
		</HydrateClient>
	);
}
