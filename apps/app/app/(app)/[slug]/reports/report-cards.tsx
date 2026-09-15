"use client";

import ChartColumn from "@carbon/icons-react/es/ChartColumn";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { REPORT_REGISTRY } from "@/lib/reports/report-registry";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function ReportCards() {
	const trpc = useTRPC();
	const { data } = useQuery(trpc.permissions.mine.queryOptions());
	const canViewMoney = data
		? data.isAdmin || data.money.includes("profit")
		: false;
	const workspaceUrl = useWorkspaceUrl();

	const reports = REPORT_REGISTRY.filter(
		(report) => !report.money || canViewMoney,
	);

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{reports.map((report) => (
				<Link key={report.id} href={workspaceUrl(`/reports/${report.id}`)}>
					<Card className="h-full transition-colors hover:bg-muted/40">
						<CardContent>
							<CardHeader>
								<Icon
									icon={ChartColumn}
									className="mb-2 size-5 text-muted-foreground"
								/>
								<CardTitle>{report.title}</CardTitle>
								<CardDescription>{report.description}</CardDescription>
							</CardHeader>
						</CardContent>
					</Card>
				</Link>
			))}
		</div>
	);
}
