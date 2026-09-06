import { serviceModifier } from "@crm/drawings";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { sensitiveWrite } from "../lib/approval";
import { applyServiceUpdate, SERVICE_WRITES } from "../lib/service-writes";
import { assertResearchPurpose } from "../lib/session-purpose";

const name = z.string().trim().min(1).max(SERVICE_WRITES.limits.maxName);
const cents = z.number().int().min(0).max(SERVICE_WRITES.limits.maxCents);
const nullableCents = cents.nullable();
const modifier = serviceModifier.nullable();

const current = z.object({
	name,
	unitPriceCents: cents,
	priceGoodCents: nullableCents,
	priceBestCents: nullableCents,
	modifier,
});

const changes = z
	.object({
		name: name.optional(),
		unitPriceCents: cents.optional(),
		priceGoodCents: nullableCents.optional(),
		priceBestCents: nullableCents.optional(),
		modifier: modifier.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one change is required.",
	});

export default defineTool({
	description:
		"Update a service on the price book: its name, prices, or modifier. A person approves before anything changes. current must be the exact values read_price_book just reported for this service — every field it read, not only the ones changing — so the approval card can show old → new. At approval the writer re-reads the live row and refuses if current no longer matches it, so read the price book again after any other update before retrying.",
	inputSchema: z.object({
		serviceId: z.cuid(),
		current,
		changes,
	}),
	approval: sensitiveWrite(
		"Propose the change in chat instead and let a rep update the service from the price book.",
	),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		return applyServiceUpdate(input.serviceId, input.current, input.changes);
	},
});
