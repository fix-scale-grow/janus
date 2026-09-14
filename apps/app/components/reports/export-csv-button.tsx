"use client";

import Download from "@carbon/icons-react/es/Download";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	buildCsv,
	type CsvColumn,
	type CsvRow,
	downloadCsv,
} from "@/lib/reports/csv";

export function ExportCsvButton({
	columns,
	rows,
	filename,
}: {
	columns: CsvColumn[];
	rows: CsvRow[];
	filename: string;
}) {
	const disabled = rows.length === 0;

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={disabled}
			onClick={() => downloadCsv(filename, buildCsv(columns, rows))}
		>
			<Icon icon={Download} data-icon="inline-start" />
			Export CSV
		</Button>
	);
}
