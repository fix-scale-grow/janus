"use client";

import ReportIcon from "@carbon/icons-react/es/Report";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import type { ReactNode } from "react";

export type DrillTableColumn<Row> = SimpleTableColumn & {
	render: (row: Row) => ReactNode;
};

export function DrillTable<Row extends { id: string }>({
	columns,
	rows,
	emptyTitle = "No data in this range",
	emptyDescription,
}: {
	columns: DrillTableColumn<Row>[];
	rows: Row[];
	emptyTitle?: string;
	emptyDescription?: string;
}) {
	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={ReportIcon} />
					</EmptyMedia>
					<EmptyTitle>{emptyTitle}</EmptyTitle>
					{emptyDescription ? (
						<EmptyDescription>{emptyDescription}</EmptyDescription>
					) : null}
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<SimpleTable columns={columns}>
			{rows.map((row) => (
				<SimpleTableRow key={row.id}>
					{columns.map((column) => (
						<TableCell key={column.id} className="px-3 py-2.5">
							{column.render(row)}
						</TableCell>
					))}
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}
