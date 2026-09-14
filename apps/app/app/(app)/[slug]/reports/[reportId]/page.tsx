import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { reportMeta } from "@/lib/reports/report-registry";
import { requireSession } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { ReportPage } from "./report-page";

const PROFIT_VIEW_KEY = "profit.view";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ reportId: string }>;
}): Promise<Metadata> {
	const { reportId } = await params;
	const meta = reportMeta(reportId);
	return { title: meta?.title ?? "Report" };
}

export default async function ReportDetailPage({
	params,
}: {
	params: Promise<{ reportId: string }>;
}) {
	const { reportId } = await params;
	const meta = reportMeta(reportId);
	if (!meta) notFound();

	await requireSession();

	if (meta.money) {
		const client = getServerTrpcClient();
		const mine = await client.permissions.mine.query();
		if (!mine.keys.includes(PROFIT_VIEW_KEY)) notFound();
	}

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{meta.title}</PageShellTitle>
					<PageShellDescription>{meta.description}</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<ReportPage meta={meta} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}
