import type { ExcalidrawElement } from "@crm/drawings";
import { BUILDING_SYMBOL_SEED } from "./building-symbol-seed";
import { LANDSCAPING_SYMBOL_SEED } from "./landscaping-symbol-seed";
import { ROOFING_SYMBOL_SEED } from "./roofing-symbol-seed";

export type SymbolSeed = {
	name: string;
	elements: ExcalidrawElement[];
	widthFt: number;
	heightFt: number;
	serviceSymbolId: string | null;
};

export type SymbolPackKey = "roofing" | "landscaping" | "building";

export type SymbolPack = {
	key: SymbolPackKey;
	label: string;
	trade: string;
	seeds: SymbolSeed[];
};

export const SYMBOL_PACKS: Record<SymbolPackKey, SymbolPack> = {
	roofing: {
		key: "roofing",
		label: "Roofing",
		trade: "roofing",
		seeds: ROOFING_SYMBOL_SEED,
	},
	landscaping: {
		key: "landscaping",
		label: "Landscaping",
		trade: "landscaping",
		seeds: LANDSCAPING_SYMBOL_SEED,
	},
	building: {
		key: "building",
		label: "General building",
		trade: "building",
		seeds: BUILDING_SYMBOL_SEED,
	},
};

export const SYMBOL_PACK_KEYS = Object.keys(SYMBOL_PACKS) as SymbolPackKey[];
