import type { FieldEntity, Prisma } from "@crm/db";
import type { FieldTypeName } from "@crm/db/fields";

const MERGE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

const TOKEN_PREFIX = {
	CONTACT: "contact.field",
	DEAL: "deal.field",
} as const satisfies Record<FieldEntity, string>;

export type MergeFieldRow = {
	field: { key: string; type: FieldTypeName; archivedAt: Date | null };
	option: { label: string } | null;
	user: { name: string } | null;
	text: string | null;
	number: Prisma.Decimal | null;
	date: Date | null;
	bool: boolean | null;
};

export type MergeFieldEntry = { token: string; value: string };

export function fieldMergeEntries(
	entity: FieldEntity,
	rows: MergeFieldRow[],
): MergeFieldEntry[] {
	const prefix = TOKEN_PREFIX[entity];
	const entries: MergeFieldEntry[] = [];

	for (const row of rows) {
		if (row.field.archivedAt !== null) continue;

		const value = formatMergeValue(row);
		if (value === null) continue;

		entries.push({ token: `${prefix}.${row.field.key}`, value });
	}

	return entries;
}

function formatMergeValue(row: MergeFieldRow): string | null {
	switch (row.field.type) {
		case "CHECKBOX":
			return row.bool === null ? null : row.bool ? "Yes" : "No";
		case "SELECT":
			return row.option?.label ?? null;
		case "DATE":
			return row.date === null ? null : MERGE_DATE_FORMAT.format(row.date);
		case "NUMBER":
			return row.number === null ? null : String(Number(row.number));
		case "USER":
			return row.user?.name ?? null;
		default:
			return row.text ?? null;
	}
}
