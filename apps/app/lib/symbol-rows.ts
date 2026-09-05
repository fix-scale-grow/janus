import { z } from "zod";

const symbolDimensionFt = z.coerce.number().positive().nullable();

export const symbolRowBase = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	trade: z.string().min(1),
	widthFt: symbolDimensionFt,
	heightFt: symbolDimensionFt,
	serviceId: z.string().min(1).nullable(),
	serviceName: z.string().min(1).nullable(),
	active: z.boolean(),
});

export type SymbolRowBase = z.infer<typeof symbolRowBase>;

export function parseSymbolRowsWith<Row>(
	schema: z.ZodType<Row>,
	value: unknown,
): { rows: Row[]; failed: number } {
	if (!Array.isArray(value)) return { rows: [], failed: 0 };
	const rows: Row[] = [];
	let failed = 0;
	for (const item of value) {
		const parsed = schema.safeParse(item);
		if (parsed.success) {
			rows.push(parsed.data);
		} else {
			failed += 1;
		}
	}
	return { rows, failed };
}
