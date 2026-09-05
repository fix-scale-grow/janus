import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import { PageShellFallback } from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { nullIfMissing } from "../../(agent-builder)/missing-record";

export const metadata: Metadata = { title: "Estimate" };

export default function EstimatePage({
	params,
}: {
	params: Promise<{ slug: string; estimateId: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedEstimate params={params} />
		</Suspense>
	);
}

async function PrefetchedEstimate({
	params,
}: {
	params: Promise<{ slug: string; estimateId: string }>;
}) {
	const { estimateId } = await params;
	const client = getServerTrpcClient();
	const estimate = await client.estimates.byId
		.query({ id: estimateId })
		.catch(nullIfMissing);

	if (!estimate) notFound();

	return (
		<EstimateBuilder estimateId={estimate.id} initialEstimate={estimate} />
	);
}
