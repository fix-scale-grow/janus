import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { PageShellFallback } from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { nullIfMissing } from "../../(agent-builder)/missing-record";

export const metadata: Metadata = { title: "Invoice" };

export default function InvoicePage({
	params,
}: {
	params: Promise<{ slug: string; invoiceId: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedInvoice params={params} />
		</Suspense>
	);
}

async function PrefetchedInvoice({
	params,
}: {
	params: Promise<{ slug: string; invoiceId: string }>;
}) {
	const { invoiceId } = await params;
	const client = getServerTrpcClient();
	const invoice = await client.invoices.byId
		.query({ id: invoiceId })
		.catch(nullIfMissing);

	if (!invoice) notFound();

	return <InvoiceDetail invoiceId={invoice.id} initialInvoice={invoice} />;
}
