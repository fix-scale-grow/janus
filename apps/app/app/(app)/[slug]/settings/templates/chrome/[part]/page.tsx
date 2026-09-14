import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { ChromePartEditor } from "./chrome-part-editor";

export const metadata: Metadata = {
	title: "Document header and footer",
};

export default function ChromePartPage({
	params,
}: {
	params: Promise<{ slug: string; part: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<PrefetchedChromePart params={params} />
		</Suspense>
	);
}

async function PrefetchedChromePart({
	params,
}: {
	params: Promise<{ slug: string; part: string }>;
}) {
	const { part } = await params;
	if (part !== "header" && part !== "footer") notFound();

	const client = getServerTrpcClient();
	const loading = client.settings.documentChrome.query();
	const workspaceLoading = client.workspace.get.query();
	await requireSession();
	const [chrome, workspace] = await Promise.all([loading, workspaceLoading]);

	return (
		<ChromePartEditor
			part={part}
			initialChrome={chrome}
			accent={workspace.brandColor ?? "#006b4f"}
		/>
	);
}
