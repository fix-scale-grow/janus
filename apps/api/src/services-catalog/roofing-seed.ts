import { PITCH_FACTORS, type ServiceModifier } from "@crm/drawings";
import type { z } from "zod";
import type { serviceFields } from "./services-catalog.contracts";

const PITCH_MODIFIER: ServiceModifier = {
	label: "Pitch",
	options: Object.entries(PITCH_FACTORS).map(([name, factor]) => ({
		name,
		factor,
	})),
};

export const PITCH_MODIFIED_SERVICE_NAMES = [
	"Tear-off & disposal",
	"Architectural shingles installed",
	"Synthetic underlayment",
];

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
		modifier: PITCH_MODIFIER,
	},
	{
		name: "Architectural shingles installed",
		unit: "PER_SQUARE",
		unitPriceCents: 42500,
		priceGoodCents: 37500,
		priceBestCents: 52500,
		modifier: PITCH_MODIFIER,
	},
	{
		name: "Synthetic underlayment",
		unit: "PER_SQUARE",
		unitPriceCents: 4500,
		modifier: PITCH_MODIFIER,
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
