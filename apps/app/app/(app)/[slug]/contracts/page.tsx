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
	type ContractStatusFilter,
	contractsSearchParams,
} from "./contracts-search-params";
import { ContractsTable } from "./contracts-table";
import { NewContractButton } from "./new-contract-button";

export const metadata: Metadata = {
	title: "Contracts",
};

export default function ContractsPage({
	searchParams,
}: PageProps<"/[slug]/contracts">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Contracts</PageShellTitle>
					<PageShellDescription>
						What has gone out for signature, and what has come back.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={null}>
						<NewContractButton />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Contracts searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Contracts({
	searchParams,
}: Pick<PageProps<"/[slug]/contracts">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		contractsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const input = contractsSearchParams.toInput(values);
	const status = input.status as ContractStatusFilter;
	await queryClient.prefetchQuery(
		trpc.contracts.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
	);

	return (
		<HydrateClient>
			<ContractsTable />
		</HydrateClient>
	);
}
