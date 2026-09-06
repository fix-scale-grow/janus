import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { TemplateEditor } from "@/components/templates/template-editor";
import { purposeFromSlug } from "@/components/templates/template-labels";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = {
	title: "Template",
};

export default function TemplatePage({
	params,
}: {
	params: Promise<{ slug: string; purpose: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedTemplate params={params} />
		</Suspense>
	);
}

async function PrefetchedTemplate({
	params,
}: {
	params: Promise<{ slug: string; purpose: string }>;
}) {
	const { purpose: slug } = await params;
	const purpose = purposeFromSlug(slug);
	if (!purpose) notFound();

	const client = getServerTrpcClient();
	const template = await client.templates.byPurpose.query({ purpose });

	return <TemplateEditor template={template} />;
}
