import { parseDrawingScale, parseDrawingScene } from "@crm/drawings";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DrawingEditor } from "@/components/drawings/drawing-editor";
import { PageShellFallback } from "@/components/page-shell";
import { maptilerApiKey } from "@/lib/env";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { nullIfMissing } from "../../(agent-builder)/missing-record";

export const metadata: Metadata = { title: "Drawing" };

export default function DrawingPage({
	params,
}: {
	params: Promise<{ slug: string; drawingId: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedDrawing params={params} />
		</Suspense>
	);
}

async function PrefetchedDrawing({
	params,
}: {
	params: Promise<{ slug: string; drawingId: string }>;
}) {
	const { slug, drawingId } = await params;
	const client = getServerTrpcClient();
	const row = await client.drawings.byId
		.query({ id: drawingId })
		.catch(nullIfMissing);

	if (!row) notFound();

	return (
		<DrawingEditor
			slug={slug}
			drawingId={row.id}
			title={row.title}
			background={row.background}
			address={row.address}
			initialScene={parseDrawingScene(row.scene)}
			initialScale={parseDrawingScale(row.scale)}
			maptilerApiKey={maptilerApiKey()}
		/>
	);
}
