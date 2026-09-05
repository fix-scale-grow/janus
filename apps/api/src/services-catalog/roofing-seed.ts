import type { z } from "zod";
import type { serviceFields } from "./services-catalog.contracts";

export const ROOFING_SEED: Omit<
	z.infer<typeof serviceFields>,
	"active" | "trade"
>[] = [
	{
		name: "Tear-off & disposal",
		unit: "PER_SQUARE",
		unitPriceCents: 8500,
		priceGoodCents: 7500,
		priceBestCents: 9500,
	},
	{
		name: "Architectural shingles installed",
		unit: "PER_SQUARE",
		unitPriceCents: 42500,
		priceGoodCents: 37500,
		priceBestCents: 52500,
	},
	{
		name: "Synthetic underlayment",
		unit: "PER_SQUARE",
		unitPriceCents: 4500,
	},
	{
		name: "Ice & water shield",
		unit: "PER_LINEAR_FT",
		unitPriceCents: 450,
	},
	{
		name: "Drip edge",
		unit: "PER_LINEAR_FT",
		unitPriceCents: 350,
		symbolId: "janus-roofing-drip-edge",
	},
	{
		name: "Ridge vent",
		unit: "PER_LINEAR_FT",
		unitPriceCents: 1250,
		symbolId: "janus-roofing-ridge-vent",
	},
	{
		name: "Gutter run",
		unit: "PER_LINEAR_FT",
		unitPriceCents: 950,
		symbolId: "janus-roofing-gutter-run",
	},
	{
		name: "Downspout",
		unit: "PER_EACH",
		unitPriceCents: 8500,
		symbolId: "janus-roofing-downspout",
	},
	{
		name: "Roof vent",
		unit: "PER_EACH",
		unitPriceCents: 7500,
		symbolId: "janus-roofing-roof-vent",
	},
	{
		name: "Pipe boot flashing",
		unit: "PER_EACH",
		unitPriceCents: 6500,
		symbolId: "janus-roofing-pipe-boot",
	},
	{
		name: "Skylight flashing kit",
		unit: "PER_EACH",
		unitPriceCents: 32500,
		symbolId: "janus-roofing-skylight",
	},
	{
		name: "Chimney flashing",
		unit: "PER_EACH",
		unitPriceCents: 45000,
		symbolId: "janus-roofing-chimney",
	},
	{
		name: "Permit & inspection",
		unit: "FLAT",
		unitPriceCents: 45000,
	},
	{
		name: "Dump trailer",
		unit: "FLAT",
		unitPriceCents: 55000,
	},
];
