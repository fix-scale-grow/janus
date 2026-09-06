import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { nullIfMissing } from "../../(agent-builder)/missing-record";
import { ContractDetail } from "./contract-detail";

export const metadata: Metadata = { title: "Contract" };

export default function ContractPage({
	params,
}: {
	params: Promise<{ slug: string; contractId: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedContract params={params} />
		</Suspense>
	);
}

async function PrefetchedContract({
	params,
}: {
	params: Promise<{ slug: string; contractId: string }>;
}) {
	const { contractId } = await params;
	const client = getServerTrpcClient();
	const contract = await client.contracts.byId
		.query({ id: contractId })
		.catch(nullIfMissing);

	if (!contract) notFound();

	return <ContractDetail contractId={contract.id} initialContract={contract} />;
}
