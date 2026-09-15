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

export async function generateMetadata({
	params,
}: {
	params: Promise<{ reportId: string }>;
}): Promise<Metadata> {
	const { reportId } = await params;
	const meta = reportMeta(reportId);
	return { title: meta?.title ?? "Report" };
}

export default function ReportDetailPage({
	params,
}: {
	params: Promise<{ reportId: string }>;
}) {
	return (
		<PageShell>
			<Suspense fallback={<PageShellLoading />}>
				<ReportDetail params={params} />
			</Suspense>
		</PageShell>
	);
}

async function ReportDetail({
	params,
}: {
	params: Promise<{ reportId: string }>;
}) {
	const [{ reportId }] = await Promise.all([params, requireSession()]);
	const meta = reportMeta(reportId);
	if (!meta) notFound();

	if (meta.money) {
		const client = getServerTrpcClient();
		const mine = await client.permissions.mine.query();
		if (!mine.isAdmin && !mine.money.includes("profit")) notFound();
	}

	return (
		<>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{meta.title}</PageShellTitle>
					<PageShellDescription>{meta.description}</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<ReportPage meta={meta} />
			</PageShellContent>
		</>
	);
}
