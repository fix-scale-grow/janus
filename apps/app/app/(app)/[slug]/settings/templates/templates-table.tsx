"use client";

import type { TemplatePurpose } from "@crm/db/enums";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LocalRelativeDate } from "@/components/local-date-time";
import { TEMPLATE_LABELS } from "@/components/templates/template-labels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type TemplateRow = RouterOutputs["templates"]["list"][number];

const TYPE_LABEL: Record<TemplateRow["type"], string> = {
	EMAIL: "Email",
	CONTRACT: "Contract",
};

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "type", header: "Type", width: "w-28" },
	{ id: "usedFor", header: "Used for" },
	{ id: "updatedAt", header: "Last edited", width: "w-40" },
	{ id: "edit", srLabel: "Edit", width: "w-20" },
];

const CELL = "px-3 py-2.5 align-middle";

export function TemplatesTable() {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();

	const templates = useQuery(trpc.templates.list.queryOptions());

	const rows = templates.data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Templates</CardTitle>
				<CardDescription>
					One template per purpose. Every workspace starts from the default
					wording.
				</CardDescription>
			</CardHeader>

			{templates.isPending ? (
				<CardTableEmpty>
					<Spinner data-icon="inline-start" />
					Loading templates…
				</CardTableEmpty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row) => {
						const label = TEMPLATE_LABELS[row.purpose as TemplatePurpose];
						return (
							<SimpleTableRow key={row.id}>
								<TableCell className={`${CELL} font-medium`}>
									{row.name}
								</TableCell>
								<TableCell className={CELL}>
									<Badge variant="secondary">{TYPE_LABEL[row.type]}</Badge>
								</TableCell>
								<TableCell className={`${CELL} text-muted-foreground`}>
									{label?.usedFor ?? "—"}
								</TableCell>
								<TableCell className={`${CELL} text-muted-foreground`}>
									<LocalRelativeDate date={row.updatedAt} />
								</TableCell>
								<TableCell className={`${CELL} text-right`}>
									<Button variant="outline" size="sm" asChild>
										<Link
											href={workspaceUrl(
												`/settings/templates/${label?.slug ?? row.purpose}`,
											)}
										>
											Edit
										</Link>
									</Button>
								</TableCell>
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			)}
		</Card>
	);
}
