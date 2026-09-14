"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "usedFor", header: "Used for" },
	{ id: "edit", srLabel: "Edit", width: "w-20" },
];

const CELL = "px-3 py-2.5 align-middle";

const PARTS = [
	{
		part: "header",
		name: "Header",
		usedFor: "Prints at the top of every contract and proposal PDF page.",
	},
	{
		part: "footer",
		name: "Footer",
		usedFor: "Prints at the bottom of every contract and proposal PDF page.",
	},
] as const;

export function DocumentChromeCard() {
	const workspaceUrl = useWorkspaceUrl();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Document header and footer</CardTitle>
				<CardDescription>
					The page frame around every contract and proposal PDF. The accent bar,
					document number and page count are added automatically.
				</CardDescription>
			</CardHeader>

			<SimpleTable columns={COLUMNS}>
				{PARTS.map((row) => (
					<SimpleTableRow key={row.part}>
						<TableCell className={`${CELL} font-medium`}>{row.name}</TableCell>
						<TableCell className={`${CELL} text-muted-foreground`}>
							{row.usedFor}
						</TableCell>
						<TableCell className={CELL}>
							<Button asChild variant="outline" size="sm">
								<Link
									href={workspaceUrl(`/settings/templates/chrome/${row.part}`)}
								>
									Edit
								</Link>
							</Button>
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
		</Card>
	);
}
