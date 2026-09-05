import { DRAWINGS, excalidrawElement } from "@crm/drawings";
import { z } from "zod";
import { listInput } from "../trpc/list-input";
import { SYMBOLS } from "./symbols.config";

export const symbolElements = z
	.array(excalidrawElement)
	.min(1)
	.max(DRAWINGS.symbol.maxElements)
	.superRefine((elements, ctx) => {
		if (Buffer.byteLength(JSON.stringify(elements)) > SYMBOLS.maxElementBytes) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "That symbol is too complex.",
			});
		}
	});

const dimensionFt = z.number().positive().max(999.99).nullish();

export const symbolFields = z.object({
	name: z.string().trim().min(1, "A symbol needs a name.").max(200),
	trade: z.string().trim().min(1).max(60).default("roofing"),
	elements: symbolElements,
	widthFt: dimensionFt,
	heightFt: dimensionFt,
	serviceId: z.string().trim().min(1).nullish(),
	active: z.boolean().default(true),
});

export const symbolListInput = listInput.extend({
	trade: z.string().optional(),
	active: z.boolean().optional(),
});

export type SymbolListInput = z.infer<typeof symbolListInput>;

export const symbolIdInput = z.object({ id: z.string().min(1) });

export type SymbolIdInput = z.infer<typeof symbolIdInput>;

export const symbolCreateInput = symbolFields;

export type SymbolCreateInput = z.infer<typeof symbolCreateInput>;

export const symbolUpdateInput = z.object({
	id: z.string().min(1),
	data: symbolFields.partial(),
});

export type SymbolUpdateInput = z.infer<typeof symbolUpdateInput>;
