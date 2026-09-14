const CSV_BOM = "﻿";
const NEEDS_QUOTING = /[",\n\r]/;

export type CsvColumn = {
	key: string;
	label: string;
};

export type CsvRow = Record<string, string | number | null>;

function csvCell(value: string | number | null): string {
	const raw = value === null ? "" : String(value);
	if (!NEEDS_QUOTING.test(raw)) return raw;
	return `"${raw.replace(/"/g, '""')}"`;
}

export function buildCsv(columns: CsvColumn[], rows: CsvRow[]): string {
	const header = columns.map((column) => csvCell(column.label)).join(",");
	const body = rows.map((row) =>
		columns.map((column) => csvCell(row[column.key] ?? null)).join(","),
	);
	return CSV_BOM + [header, ...body].join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
	const url = URL.createObjectURL(
		new Blob([content], { type: "text/csv;charset=utf-8" }),
	);
	const anchor = window.document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
