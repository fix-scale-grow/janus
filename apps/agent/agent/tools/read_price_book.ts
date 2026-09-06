import { defineTool } from "eve/tools";
import { z } from "zod";
import { listPriceBook } from "../lib/price-book";

export default defineTool({
	description:
		"List the active services on the price book: name, unit, book price, the good/best prices when the service has them, its modifier if any, and the symbol it draws with when it has one. Service names are admin catalog data, not customer text. Free. Read this before proposing an estimate line, tagging a drawing shape, or updating a service — the current values it returns are what update_service needs.",
	inputSchema: z.object({
		trade: z
			.string()
			.trim()
			.min(1)
			.max(60)
			.optional()
			.describe("Narrow to one trade, e.g. 'roofing'. Defaults to all."),
	}),
	async execute({ trade }) {
		const services = await listPriceBook(trade);

		return {
			services,
			note:
				services.length === 0
					? "No active services on the price book."
					: undefined,
		};
	},
});
