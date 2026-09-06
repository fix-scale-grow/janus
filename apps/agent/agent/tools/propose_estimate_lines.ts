import { ServiceUnit } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { sensitiveWrite } from "../lib/approval";
import { applyEstimateLines } from "../lib/estimate-writes";
import { assertResearchPurpose } from "../lib/session-purpose";

const ESTIMATE_LINES = {
	limits: {
		maxEstimateTitle: 200,
		maxServiceName: 120,
		maxName: 200,
		maxReason: 280,
		maxQuantity: 9_999_999.99,
		maxUnitPriceCents: 99_999_999,
		maxLines: 30,
	},
} as const;

const unitEnum = z.enum(
	Object.values(ServiceUnit) as [ServiceUnit, ...ServiceUnit[]],
);

const line = z.object({
	serviceId: z.cuid().optional(),
	serviceName: z
		.string()
		.trim()
		.min(1)
		.max(ESTIMATE_LINES.limits.maxServiceName)
		.optional(),
	name: z.string().trim().min(1).max(ESTIMATE_LINES.limits.maxName),
	unit: unitEnum,
	quantity: z.number().positive().max(ESTIMATE_LINES.limits.maxQuantity),
	unitPriceCents: z
		.number()
		.int()
		.min(0)
		.max(ESTIMATE_LINES.limits.maxUnitPriceCents)
		.optional(),
	reason: z.string().trim().min(1).max(ESTIMATE_LINES.limits.maxReason),
	source: z.enum(["missing", "note", "chat"]),
});

export default defineTool({
	description:
		"Propose one or more line items for an estimate: a missing item, a drawing note turned into a line, or one asked for in chat. A person approves before anything is added. Fill unitPriceCents from the book price read_crm_history or the service catalog reported, so the rep sees a price on the card before approving — it is display only. At approval the live book price on the service is copied onto any line with a serviceId, never the value proposed here, and a custom line without one is added at zero.",
	inputSchema: z.object({
		estimateId: z.cuid(),
		estimateTitle: z
			.string()
			.trim()
			.min(1)
			.max(ESTIMATE_LINES.limits.maxEstimateTitle),
		lines: z.array(line).min(1).max(ESTIMATE_LINES.limits.maxLines),
	}),
	approval: sensitiveWrite(
		"Propose the line items in chat instead and let a rep add them from the estimate.",
	),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		return applyEstimateLines(
			input.estimateId,
			input.lines.map((entry) => ({
				serviceId: entry.serviceId,
				name: entry.name,
				unit: entry.unit,
				quantity: entry.quantity,
			})),
		);
	},
});
