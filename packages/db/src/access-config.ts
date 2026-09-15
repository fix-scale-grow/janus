export const ACCESS_AREAS = [
	"contacts",
	"deals",
	"drawings",
	"estimates",
	"contracts",
	"invoices",
	"projects",
	"photos",
	"permits",
	"forms",
	"jobCosts",
	"reports",
] as const;

export type AccessArea = (typeof ACCESS_AREAS)[number];

export const ACCESS_LEVELS = ["HIDDEN", "VIEW", "EDIT", "DELETE"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const STANDALONE_ACTIONS = [
	"jobCosts.submit",
	"deals.markComplete",
	"contracts.signInPerson",
] as const;
export type StandaloneAction = (typeof STANDALONE_ACTIONS)[number];

export const MONEY_SWITCHES = ["prices", "profit", "priceBook"] as const;
export type MoneySwitch = (typeof MONEY_SWITCHES)[number];

export const ACCESS_SCOPES = ["ALL", "OWN", "ASSIGNED"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export const ACCESS_SURFACES = ["FULL", "FIELD"] as const;
export type AccessSurface = (typeof ACCESS_SURFACES)[number];

type AreaLevels = Record<AccessArea, AccessLevel>;

type SeedGroupPolicy = {
	areas: AreaLevels;
	actions: readonly StandaloneAction[];
	money: readonly MoneySwitch[];
};

type SeedGroup = {
	key: string;
	name: string;
	surface: AccessSurface;
	scope: AccessScope;
	policy: SeedGroupPolicy;
};

function levels(overrides: Partial<AreaLevels>): AreaLevels {
	const base = Object.fromEntries(
		ACCESS_AREAS.map((area) => [area, "HIDDEN"]),
	) as AreaLevels;
	return { ...base, ...overrides };
}

const areaLabel: Record<AccessArea, string> = {
	contacts: "contacts",
	deals: "deals",
	drawings: "drawings",
	estimates: "estimates",
	contracts: "contracts",
	invoices: "invoices",
	projects: "projects",
	photos: "photos",
	permits: "permits",
	forms: "forms",
	jobCosts: "job costs",
	reports: "reports",
};

const levelVerb: Record<AccessLevel, string> = {
	HIDDEN: "see",
	VIEW: "view",
	EDIT: "edit",
	DELETE: "delete",
};

const actionVerb: Record<StandaloneAction, string> = {
	"jobCosts.submit": "submit receipts for",
	"deals.markComplete": "mark complete",
	"contracts.signInPerson": "take signatures on",
};

const seedGroups: readonly SeedGroup[] = [
	{
		key: "sales-clerk",
		name: "Sales clerk",
		surface: "FULL",
		scope: "OWN",
		policy: {
			areas: levels({
				contacts: "EDIT",
				deals: "EDIT",
				drawings: "EDIT",
				estimates: "EDIT",
				photos: "VIEW",
			}),
			actions: [],
			money: ["prices"],
		},
	},
	{
		key: "office",
		name: "Office",
		surface: "FULL",
		scope: "ALL",
		policy: {
			areas: levels({
				contacts: "EDIT",
				deals: "EDIT",
				drawings: "EDIT",
				estimates: "EDIT",
				contracts: "EDIT",
				invoices: "EDIT",
				projects: "EDIT",
				photos: "EDIT",
				permits: "EDIT",
				forms: "EDIT",
				jobCosts: "EDIT",
				reports: "VIEW",
			}),
			actions: [],
			money: ["prices"],
		},
	},
	{
		key: "crew-lead",
		name: "Crew lead",
		surface: "FIELD",
		scope: "ASSIGNED",
		policy: {
			areas: levels({ projects: "EDIT", photos: "EDIT" }),
			actions: [
				"jobCosts.submit",
				"deals.markComplete",
				"contracts.signInPerson",
			],
			money: [],
		},
	},
];

export const ACCESS = {
	areas: ACCESS_AREAS,
	levels: ACCESS_LEVELS,
	actions: STANDALONE_ACTIONS,
	money: MONEY_SWITCHES,
	scopes: ACCESS_SCOPES,
	surfaces: ACCESS_SURFACES,
	viewOnlyAreas: ["reports"] as readonly AccessArea[],
	areaLabel,
	levelVerb,
	actionVerb,
	fieldPathPrefix: "/field",
	seedGroups,
	legacyProfitGroupName: "Office + profit",
} as const;
