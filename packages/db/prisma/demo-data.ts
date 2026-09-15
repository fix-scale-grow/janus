import { db } from "../src/client";
import { DEFAULT_REPORTING_CURRENCY } from "../src/currency";
import { ActivityType, StageOutcome } from "../src/generated/prisma/enums";
import { readReportingCurrency, SETTINGS_ID } from "../src/settings";
import { requiresReason } from "../src/stage-semantics";

function makeRandom(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = makeRandom(20260915);

function pick<T>(items: readonly T[]): T {
	const item = items[Math.floor(random() * items.length)];
	if (item === undefined) throw new Error("pick() on an empty list");
	return item;
}

function chance(probability: number): boolean {
	return random() < probability;
}

function integer(min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function daysFromNow(days: number, jitterHours = 0): Date {
	const jitter = jitterHours
		? (random() - 0.5) * jitterHours * 60 * 60 * 1000
		: 0;
	return new Date(NOW + days * DAY_MS + jitter);
}

export const DEMO_CURRENCY = "USD";

export const DEMO_DEAL_ID_PREFIX = "seed-deal-";

export const DEMO_EMAIL_DOMAINS = ["example.com", "example.net"] as const;

export const OWNERS = [
	{ name: "Dana Whitaker", email: "dana.whitaker@example.com" },
	{ name: "Rick Callahan", email: "rick.callahan@example.com" },
	{ name: "Maria Delgado", email: "maria.delgado@example.com" },
] as const;

type SeedPerson = { firstName: string; lastName: string; title: string | null };

const CONTACT_ROLES = {
	homeowner: "Homeowner",
	propertyManager: "Property manager",
	insuranceAdjuster: "Insurance adjuster",
	generalContractor: "General contractor",
} as const;

type ContactRole = (typeof CONTACT_ROLES)[keyof typeof CONTACT_ROLES];

type SeedCustomer = {
	key: string;
	companyName: string | null;
	role?: ContactRole;
	emailDomain: (typeof DEMO_EMAIL_DOMAINS)[number];
	areaCode: string;
	street: string;
	city: string;
	state: string;
	zip: string;
	people: readonly SeedPerson[];
};

const homeowner = (firstName: string, lastName: string): SeedPerson => ({
	firstName,
	lastName,
	title: null,
});

export const CUSTOMERS: readonly SeedCustomer[] = [
	{
		key: "henderson",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1200 Example Ave",
		city: "Overland Park",
		state: "KS",
		zip: "66213",
		people: [homeowner("Mark", "Henderson"), homeowner("Julie", "Henderson")],
	},
	{
		key: "patel",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1210 Sample St",
		city: "Olathe",
		state: "KS",
		zip: "66061",
		people: [homeowner("Anjali", "Patel")],
	},
	{
		key: "oak-ridge-hoa",
		companyName: "Oak Ridge HOA",
		emailDomain: "example.net",
		areaCode: "913",
		street: "1220 Placeholder Ln",
		city: "Lenexa",
		state: "KS",
		zip: "66219",
		people: [
			{ firstName: "Linda", lastName: "Crawford", title: "Property Manager" },
		],
	},
	{
		key: "nguyen",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1230 Demo Ct",
		city: "Lee's Summit",
		state: "MO",
		zip: "64082",
		people: [homeowner("Thomas", "Nguyen")],
	},
	{
		key: "brooks",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1240 Fictional Dr",
		city: "Shawnee",
		state: "KS",
		zip: "66203",
		people: [homeowner("Karen", "Brooks")],
	},
	{
		key: "ramirez",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1250 Testing Way",
		city: "Independence",
		state: "MO",
		zip: "64052",
		people: [homeowner("Daniel", "Ramirez")],
	},
	{
		key: "coleman",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1260 Mockup Rd",
		city: "Leawood",
		state: "KS",
		zip: "66211",
		people: [homeowner("Steve", "Coleman")],
	},
	{
		key: "summit-property-group",
		companyName: "Summit Property Group",
		emailDomain: "example.net",
		areaCode: "816",
		street: "1270 Example Ave",
		city: "Kansas City",
		state: "MO",
		zip: "64111",
		people: [
			{ firstName: "Rachel", lastName: "Dunn", title: "Facilities Manager" },
			{ firstName: "Omar", lastName: "Haddad", title: "Asset Manager" },
		],
	},
	{
		key: "walsh",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1280 Sample St",
		city: "Prairie Village",
		state: "KS",
		zip: "66208",
		people: [homeowner("Brian", "Walsh")],
	},
	{
		key: "foster",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1290 Placeholder Ln",
		city: "Blue Springs",
		state: "MO",
		zip: "64015",
		people: [homeowner("Emily", "Foster")],
	},
	{
		key: "kim",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1300 Demo Ct",
		city: "Lenexa",
		state: "KS",
		zip: "66215",
		people: [homeowner("Grace", "Kim")],
	},
	{
		key: "hartley-builders",
		companyName: "Hartley Builders",
		role: CONTACT_ROLES.generalContractor,
		emailDomain: "example.net",
		areaCode: "816",
		street: "1310 Fictional Dr",
		city: "Liberty",
		state: "MO",
		zip: "64068",
		people: [
			{ firstName: "Jake", lastName: "Hartley", title: "General Contractor" },
		],
	},
	{
		key: "sullivan",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1320 Testing Way",
		city: "Parkville",
		state: "MO",
		zip: "64152",
		people: [homeowner("Megan", "Sullivan")],
	},
	{
		key: "bennett",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1330 Mockup Rd",
		city: "Gladstone",
		state: "MO",
		zip: "64118",
		people: [homeowner("Carl", "Bennett")],
	},
	{
		key: "maple-court-apartments",
		companyName: "Maple Court Apartments",
		emailDomain: "example.net",
		areaCode: "913",
		street: "1340 Example Ave",
		city: "Kansas City",
		state: "KS",
		zip: "66112",
		people: [
			{ firstName: "Tony", lastName: "Russo", title: "Property Manager" },
		],
	},
	{
		key: "ortiz",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1350 Sample St",
		city: "Raytown",
		state: "MO",
		zip: "64133",
		people: [homeowner("Marco", "Ortiz")],
	},
	{
		key: "price",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1360 Placeholder Ln",
		city: "Merriam",
		state: "KS",
		zip: "66203",
		people: [homeowner("Heather", "Price")],
	},
	{
		key: "morgan",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1370 Demo Ct",
		city: "Olathe",
		state: "KS",
		zip: "66062",
		people: [homeowner("Jason", "Morgan")],
	},
	{
		key: "jenkins",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1380 Fictional Dr",
		city: "Grandview",
		state: "MO",
		zip: "64030",
		people: [homeowner("Denise", "Jenkins")],
	},
	{
		key: "reed",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "816",
		street: "1390 Testing Way",
		city: "Belton",
		state: "MO",
		zip: "64012",
		people: [homeowner("Kevin", "Reed"), homeowner("Sarah", "Reed")],
	},
	{
		key: "carter",
		companyName: null,
		emailDomain: "example.com",
		areaCode: "913",
		street: "1400 Mockup Rd",
		city: "Mission",
		state: "KS",
		zip: "66202",
		people: [homeowner("Angela", "Carter")],
	},
];

type SeedDealDef = {
	customer: string;
	name: string;
	pipelineId: "pipeline_seed_sales" | "pipeline_seed_insurance";
	stageKey: string;
	amount: number;
	description: string;
	closedReason?: string;
};

const DEALS: readonly SeedDealDef[] = [
	{
		customer: "henderson",
		name: "Henderson Full Tear-Off",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CONTRACT_SENT",
		amount: 24800,
		description:
			"Two-story colonial, 32 squares, two layers of old 3-tab. They want Charcoal architectural shingles and new ridge vent. Contract is out for both signatures.",
	},
	{
		customer: "henderson",
		name: "Henderson Gutter Replacement",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DEMO_BOOKED",
		amount: 3200,
		description:
			"Asked about 6 inch seamless gutters and guards while we are on site for the re-roof.",
	},
	{
		customer: "patel",
		name: "Patel Storm Damage Repair",
		pipelineId: "pipeline_seed_insurance",
		stageKey: "ADJUSTER_MEETING",
		amount: 9800,
		description:
			"Wind lifted shingles on the south slope and a section of drip edge is gone. Adjuster meeting is booked; bring the drone photos.",
	},
	{
		customer: "oak-ridge-hoa",
		name: "Oak Ridge HOA Gutter Replacement",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DECISION_MAKER_BOUGHT_IN",
		amount: 12600,
		description:
			"Gutters and downspouts on four townhome buildings. The board votes on the estimate at the next monthly meeting.",
	},
	{
		customer: "oak-ridge-hoa",
		name: "Oak Ridge HOA Clubhouse Re-Roof",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DEMO_BOOKED",
		amount: 28900,
		description:
			"Clubhouse roof is past 25 years with granule loss everywhere. Property manager wants numbers for next year's reserve budget.",
	},
	{
		customer: "nguyen",
		name: "Nguyen Leak Repair",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_WON",
		amount: 450,
		description:
			"Active leak at the bathroom vent boot. Replaced the boot and sealed the surrounding shingles.",
	},
	{
		customer: "brooks",
		name: "Brooks Architectural Shingle Re-Roof",
		pipelineId: "pipeline_seed_sales",
		stageKey: "QUALIFIED_TO_BUY",
		amount: 18900,
		description:
			"Ranch home, 24 squares, one layer. Inspection is booked for Thursday morning; check the decking over the garage.",
	},
	{
		customer: "ramirez",
		name: "Ramirez Skylight Flashing Repair",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DEMO_BOOKED",
		amount: 1250,
		description:
			"Water stain on the kitchen ceiling under the skylight. Came in from the website form.",
	},
	{
		customer: "coleman",
		name: "Coleman Standing Seam Metal Roof",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DECISION_MAKER_BOUGHT_IN",
		amount: 38000,
		description:
			"Wants a standing seam metal roof in Dark Bronze. Comparing us with one other roofer; lead time on panels is the sticking point.",
	},
	{
		customer: "summit-property-group",
		name: "Summit Property Group Flat Roof Coating",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CONTRACT_SENT",
		amount: 27500,
		description:
			"Silicone coating over the existing modified bitumen on a two-story office building. Work has to happen on weekends.",
	},
	{
		customer: "walsh",
		name: "Walsh Chimney Flashing and Cricket",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_WON",
		amount: 2100,
		description:
			"New step and counter flashing plus a cricket behind the chimney. Paid in full at completion.",
	},
	{
		customer: "foster",
		name: "Foster Full Tear-Off",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_LOST",
		amount: 21300,
		description:
			"Full replacement, 28 squares, steep 10/12 pitch in back. Homeowner got three bids.",
		closedReason: "Went with a lower bid",
	},
	{
		customer: "kim",
		name: "Kim Soffit and Fascia Replacement",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DEMO_BOOKED",
		amount: 4800,
		description:
			"Rotted fascia boards on the front elevation and squirrels in the soffit. Wants aluminum wrap.",
	},
	{
		customer: "hartley-builders",
		name: "Hartley Builders New Construction Roof",
		pipelineId: "pipeline_seed_sales",
		stageKey: "QUALIFIED_TO_BUY",
		amount: 31750,
		description:
			"New build in Liberty. GC needs the roof dried in before framing inspection; site walk is scheduled.",
	},
	{
		customer: "sullivan",
		name: "Sullivan Attic Ventilation",
		pipelineId: "pipeline_seed_sales",
		stageKey: "UNQUALIFIED_TO_BUY",
		amount: 1850,
		description:
			"Asked for ridge vent and two intake vents on a lake cabin two hours north.",
		closedReason: "Outside our service area",
	},
	{
		customer: "bennett",
		name: "Bennett Roof Inspection and Tune-Up",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_WON",
		amount: 475,
		description:
			"Pre-sale inspection for the buyer's agent. Resealed exposed nail heads and replaced six shingles.",
	},
	{
		customer: "maple-court-apartments",
		name: "Maple Court Apartments TPO Replacement",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_LOST",
		amount: 36400,
		description:
			"Tear off and replace the ponding TPO on building C, with tapered insulation to fix drainage.",
		closedReason: "Owner pushed the project to next year",
	},
	{
		customer: "ortiz",
		name: "Ortiz Gutter Guards",
		pipelineId: "pipeline_seed_sales",
		stageKey: "DECISION_MAKER_BOUGHT_IN",
		amount: 2650,
		description:
			"Micro-mesh guards on 180 feet of existing gutters. Two oak trees over the back of the house.",
	},
	{
		customer: "price",
		name: "Price Full Tear-Off",
		pipelineId: "pipeline_seed_sales",
		stageKey: "CLOSED_WON",
		amount: 16200,
		description:
			"Replaced 20 squares with Weathered Wood architectural shingles and ice and water shield at the eaves.",
	},
	{
		customer: "morgan",
		name: "Morgan Hail Damage Re-Roof",
		pipelineId: "pipeline_seed_insurance",
		stageKey: "NEW_CLAIM",
		amount: 22400,
		description:
			"Hail from last week's storm. Soft metals are dented and there are hits on every slope. Homeowner filed the claim yesterday.",
	},
	{
		customer: "jenkins",
		name: "Jenkins Wind Damage Repair",
		pipelineId: "pipeline_seed_insurance",
		stageKey: "APPROVED",
		amount: 5600,
		description:
			"Carrier approved the repair of the west slope and the ridge cap. Waiting on the first check before we order material.",
	},
	{
		customer: "reed",
		name: "Reed Hail Damage Re-Roof",
		pipelineId: "pipeline_seed_insurance",
		stageKey: "CLAIM_WON",
		amount: 19750,
		description:
			"Full replacement approved by the carrier, with gutters and window screens added as supplements.",
	},
	{
		customer: "carter",
		name: "Carter Tree Impact Repair",
		pipelineId: "pipeline_seed_insurance",
		stageKey: "CLAIM_LOST",
		amount: 7300,
		description:
			"Limb came through the garage roof during the storm. Need to replace decking and rafters on one bay.",
		closedReason: "Claim denied by the carrier",
	},
];

type SeedStageDef = {
	id: string;
	key: string;
	label: string;
	color: string;
	position: number;
	outcome: StageOutcome;
	isEntry: boolean;
};

const SALES_STAGES: readonly SeedStageDef[] = [
	{
		id: "stage_seed_demo_booked",
		key: "DEMO_BOOKED",
		label: "New lead",
		color: "var(--chart-1)",
		position: 0,
		outcome: StageOutcome.OPEN,
		isEntry: true,
	},
	{
		id: "stage_seed_qualified_to_buy",
		key: "QUALIFIED_TO_BUY",
		label: "Inspection scheduled",
		color: "var(--chart-2)",
		position: 1,
		outcome: StageOutcome.OPEN,
		isEntry: false,
	},
	{
		id: "stage_seed_decision_maker_bought_in",
		key: "DECISION_MAKER_BOUGHT_IN",
		label: "Estimate sent",
		color: "var(--chart-3)",
		position: 2,
		outcome: StageOutcome.OPEN,
		isEntry: false,
	},
	{
		id: "stage_seed_contract_sent",
		key: "CONTRACT_SENT",
		label: "Contract sent",
		color: "var(--chart-4)",
		position: 3,
		outcome: StageOutcome.OPEN,
		isEntry: false,
	},
	{
		id: "stage_seed_closed_won",
		key: "CLOSED_WON",
		label: "Won",
		color: "var(--swatch-1)",
		position: 4,
		outcome: StageOutcome.WON,
		isEntry: false,
	},
	{
		id: "stage_seed_closed_lost",
		key: "CLOSED_LOST",
		label: "Lost",
		color: "var(--swatch-2)",
		position: 5,
		outcome: StageOutcome.LOST,
		isEntry: false,
	},
	{
		id: "stage_seed_unqualified_to_buy",
		key: "UNQUALIFIED_TO_BUY",
		label: "Unqualified",
		color: "var(--swatch-3)",
		position: 6,
		outcome: StageOutcome.DISQUALIFIED,
		isEntry: false,
	},
];

const INSURANCE_STAGES: readonly SeedStageDef[] = [
	{
		id: "stage_seed_insurance_new_claim",
		key: "NEW_CLAIM",
		label: "New claim",
		color: "var(--chart-1)",
		position: 0,
		outcome: StageOutcome.OPEN,
		isEntry: true,
	},
	{
		id: "stage_seed_insurance_adjuster_meeting",
		key: "ADJUSTER_MEETING",
		label: "Adjuster meeting",
		color: "var(--chart-2)",
		position: 1,
		outcome: StageOutcome.OPEN,
		isEntry: false,
	},
	{
		id: "stage_seed_insurance_approved",
		key: "APPROVED",
		label: "Approved",
		color: "var(--chart-3)",
		position: 2,
		outcome: StageOutcome.OPEN,
		isEntry: false,
	},
	{
		id: "stage_seed_insurance_won",
		key: "CLAIM_WON",
		label: "Won",
		color: "var(--swatch-1)",
		position: 3,
		outcome: StageOutcome.WON,
		isEntry: false,
	},
	{
		id: "stage_seed_insurance_lost",
		key: "CLAIM_LOST",
		label: "Lost",
		color: "var(--swatch-2)",
		position: 4,
		outcome: StageOutcome.LOST,
		isEntry: false,
	},
];

type SeededStage = {
	id: string;
	key: string;
	seedKey: string;
	outcome: StageOutcome;
	pipelineId: string;
	seedPipelineId: SeedDealDef["pipelineId"];
};

export type SeededPipelines = {
	open: SeededStage[];
	closed: SeededStage[];
	entryKeyByPipelineId: Record<string, string>;
};

const SEED_PIPELINES: readonly {
	id: SeedDealDef["pipelineId"];
	name: string;
	position: number;
	stages: readonly SeedStageDef[];
}[] = [
	{
		id: "pipeline_seed_sales",
		name: "Sales",
		position: 0,
		stages: SALES_STAGES,
	},
	{
		id: "pipeline_seed_insurance",
		name: "Insurance",
		position: 1,
		stages: INSURANCE_STAGES,
	},
];

async function resolvePipelineId(
	def: (typeof SEED_PIPELINES)[number],
): Promise<string> {
	const seeded = await db.pipeline.findUnique({
		where: { id: def.id },
		select: { id: true },
	});
	if (seeded) return seeded.id;

	const sameName = await db.pipeline.findFirst({
		where: { name: def.name, archivedAt: null },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: { id: true },
	});
	if (sameName) return sameName.id;

	const created = await db.pipeline.create({
		data: { id: def.id, name: def.name, position: def.position },
		select: { id: true },
	});
	return created.id;
}

async function resolveStage(
	pipelineId: string,
	def: SeedStageDef,
): Promise<{ id: string; key: string; isEntry: boolean }> {
	const select = { id: true, key: true, isEntry: true } as const;

	const seeded = await db.stage.findUnique({ where: { id: def.id }, select });
	if (seeded) return seeded;

	const sameLabel = await db.stage.findFirst({
		where: {
			pipelineId,
			archivedAt: null,
			outcome: def.outcome,
			label: { equals: def.label, mode: "insensitive" },
		},
		orderBy: { position: "asc" },
		select,
	});
	if (sameLabel) return sameLabel;

	const entry = await db.stage.findFirst({
		where: { pipelineId, isEntry: true, archivedAt: null },
		select: { id: true },
	});

	return db.stage.create({
		data: {
			id: def.id,
			pipelineId,
			key: def.key,
			label: def.label,
			color: def.color,
			position: def.position,
			outcome: def.outcome,
			isEntry: def.isEntry && entry === null,
		},
		select,
	});
}

export async function seedPipelines(): Promise<SeededPipelines> {
	const stages: SeededStage[] = [];
	const entryKeyByPipelineId: Record<string, string> = {};

	for (const pipeline of SEED_PIPELINES) {
		const pipelineId = await resolvePipelineId(pipeline);

		for (const def of pipeline.stages) {
			const stage = await resolveStage(pipelineId, def);
			stages.push({
				id: stage.id,
				key: stage.key,
				seedKey: def.key,
				outcome: def.outcome,
				pipelineId,
				seedPipelineId: pipeline.id,
			});
		}

		const entry = await db.stage.findFirst({
			where: { pipelineId, isEntry: true, archivedAt: null },
			select: { key: true },
		});
		if (entry) entryKeyByPipelineId[pipelineId] = entry.key;
	}

	return {
		open: stages.filter((stage) => stage.outcome === StageOutcome.OPEN),
		closed: stages.filter((stage) => stage.outcome !== StageOutcome.OPEN),
		entryKeyByPipelineId,
	};
}

const NOTE_BODIES = [
	"Walked the roof with the homeowner. Two soft spots in the decking near the valley; added a decking allowance to the estimate.",
	"Adjuster agreed on the hail hits on the north and west slopes. Waiting on the scope of loss before we supplement.",
	"Homeowner narrowed shingle colors to Charcoal and Weathered Wood. Dropping off sample boards Friday.",
	"Material delivery confirmed for Tuesday at 7am. Driveway is steep, so the supplier is sending a boom truck.",
	"Crew is booked for a two-day install. Forecast shows rain Thursday, so we start Monday.",
	"HOA needs a certificate of insurance before anyone goes on site.",
	"Asked about financing. Sent the 12 month same-as-cash option.",
	"Permit application submitted to the city. Inspection gets scheduled after tear-off.",
] as const;

const CALL_SUBJECTS = [
	"Inspection follow-up",
	"Call with insurance adjuster",
	"Shingle color questions",
	"Scheduling the install",
	"Financing options",
] as const;

const TASK_SUBJECTS = [
	"Upload inspection photos",
	"Send the estimate",
	"Order shingles and underlayment",
	"Confirm dumpster drop-off",
	"Schedule crew for tear-off",
	"Collect deposit",
	"Book final walkthrough",
] as const;

const MEETING_SUBJECTS = [
	"Roof inspection",
	"Adjuster meeting on site",
	"Shingle color selection",
	"Final walkthrough",
] as const;

const EMAIL_SUBJECTS = [
	"Your roof inspection photos",
	"Estimate for your roof",
	"Install date confirmed",
	"Material delivery window",
] as const;

export function demoContactRole(companyName: string | null): ContactRole {
	if (companyName === null) return CONTACT_ROLES.homeowner;
	const customer = CUSTOMERS.find((entry) => entry.companyName === companyName);
	return customer?.role ?? CONTACT_ROLES.propertyManager;
}

const TRANSLITERATIONS: Record<string, string> = {
	ø: "o",
	æ: "ae",
	œ: "oe",
	å: "a",
	ß: "ss",
	đ: "d",
	ł: "l",
	þ: "th",
};

export function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[øæœåßđłþ]/g, (char) => TRANSLITERATIONS[char] ?? char)
		.normalize("NFD")
		.replace(/\p{Mn}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export async function seedOwners(): Promise<string[]> {
	const existing = await db.user.findMany({ select: { id: true } });

	if (existing.length > 0) {
		console.log(`Using ${existing.length} existing user(s) as owners.`);
		return existing.map((user) => user.id);
	}

	console.log("No users yet, creating placeholder sales reps.");
	const created = await Promise.all(
		OWNERS.map((owner) =>
			db.user.upsert({
				where: { email: owner.email },
				create: {
					id: `seed-${slug(owner.name)}`,
					name: owner.name,
					email: owner.email,
					emailVerified: true,
					updatedAt: new Date(),
				},
				update: {},
				select: { id: true },
			}),
		),
	);

	return created.map((user) => user.id);
}

export type SeededContact = { id: string; customer: string };

export async function seedContacts(
	ownerIds: string[],
): Promise<SeededContact[]> {
	const contacts: SeededContact[] = [];
	let line = 100;

	for (const customer of CUSTOMERS) {
		for (const person of customer.people) {
			line += 1;
			const email = `${slug(person.firstName)}.${slug(person.lastName)}@${customer.emailDomain}`;

			const contact = await db.contact.upsert({
				where: { email },
				create: {
					firstName: person.firstName,
					lastName: person.lastName,
					email,
					title: person.title,
					phone: chance(0.85)
						? `+1 ${customer.areaCode} 555 0${String(line).slice(-3)}`
						: null,
					companyName: customer.companyName,
					ownerId: pick(ownerIds),
					createdAt: daysFromNow(-integer(10, 300), 12),
				},
				update: {},
				select: { id: true },
			});

			contacts.push({ id: contact.id, customer: customer.key });
		}
	}

	return contacts;
}

type SeededDeal = {
	id: string;
	ownerId: string;
	closed: boolean;
	contactIds: string[];
	stageKey: string;
	pipelineId: string;
};

export function demoDealIds(): string[] {
	const counts = new Map<string, number>();
	return DEALS.map((deal) => {
		const n = counts.get(deal.customer) ?? 0;
		counts.set(deal.customer, n + 1);
		return `${DEMO_DEAL_ID_PREFIX}${deal.customer}-${n}`;
	});
}

let seedBase = DEMO_CURRENCY;

export async function seedSettings(): Promise<string> {
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: {
			id: SETTINGS_ID,
			reportingCurrency: DEFAULT_REPORTING_CURRENCY,
		},
		update: {},
		select: { id: true },
	});

	seedBase = await readReportingCurrency(db);

	if (seedBase !== DEMO_CURRENCY) {
		console.log(
			`Reporting currency is ${seedBase}. Demo deals are in ${DEMO_CURRENCY}; ` +
				"the rates cron converts them.",
		);
	}

	return seedBase;
}

function money(amount: number, at: Date) {
	const converted = seedBase === DEMO_CURRENCY;

	return {
		amount,
		currency: DEMO_CURRENCY,
		baseAmount: converted ? amount : null,
		baseCurrency: converted ? DEMO_CURRENCY : null,
		fxRate: converted ? 1 : null,
		fxRateAt: converted ? at : null,
	};
}

export async function seedDeals(
	contacts: SeededContact[],
	ownerIds: string[],
	stages: SeededPipelines,
): Promise<SeededDeal[]> {
	const deals: SeededDeal[] = [];
	const ids = demoDealIds();
	const allStages = [...stages.open, ...stages.closed];

	for (const [index, def] of DEALS.entries()) {
		const id = ids[index];
		if (!id) throw new Error(`no id for demo deal ${def.name}`);

		const stage = allStages.find(
			(candidate) =>
				candidate.seedPipelineId === def.pipelineId &&
				candidate.seedKey === def.stageKey,
		);
		if (!stage) {
			throw new Error(`stage ${def.stageKey} missing in ${def.pipelineId}`);
		}

		const customer = CUSTOMERS.find((entry) => entry.key === def.customer);
		if (!customer) throw new Error(`customer ${def.customer} missing`);

		const closed = stage.outcome !== StageOutcome.OPEN;
		const ownerId = pick(ownerIds);
		const createdDaysAgo = integer(20, 180);
		const createdAt = daysFromNow(-createdDaysAgo, 12);
		const closedDaysAgo = closed
			? integer(0, Math.max(createdDaysAgo - 14, 0))
			: null;
		const stageChangedAt = daysFromNow(
			closedDaysAgo === null ? -integer(1, 20) : -closedDaysAgo,
			12,
		);
		const address = `${customer.street}, ${customer.city}, ${customer.state} ${customer.zip}`;

		await db.deal.upsert({
			where: { id },
			create: {
				id,
				name: def.name,
				description: `${address}. ${def.description}`,
				ownerId,
				stageId: stage.id,
				stageChangedAt,
				...money(def.amount, createdAt),
				expectedCloseDate: daysFromNow(
					closedDaysAgo === null
						? integer(-10, 60)
						: -closedDaysAgo + integer(-4, 9),
				),
				closedAt: closed ? stageChangedAt : null,
				closedReason: requiresReason(stage) ? (def.closedReason ?? null) : null,
				createdAt,
			},
			update: {},
		});

		const role = demoContactRole(customer.companyName);
		const dealContactIds: string[] = [];
		for (const contact of contacts.filter(
			(entry) => entry.customer === def.customer,
		)) {
			await db.dealContact.upsert({
				where: { dealId_contactId: { dealId: id, contactId: contact.id } },
				create: { dealId: id, contactId: contact.id, role },
				update: {},
			});
			dealContactIds.push(contact.id);
		}

		deals.push({
			id,
			ownerId,
			closed,
			contactIds: dealContactIds,
			stageKey: stage.key,
			pipelineId: stage.pipelineId,
		});
	}

	return deals;
}

export async function seedActivities(
	deals: SeededDeal[],
	entryKeyByPipelineId: Record<string, string>,
): Promise<number> {
	const existing = await db.activity.count({
		where: { dealId: { in: deals.map((deal) => deal.id) } },
	});
	if (existing > 0) {
		console.log(`Demo activities already seeded (${existing}), skipping.`);
		return existing;
	}

	type ActivityRow = {
		type: ActivityType;
		subject: string | null;
		body: string | null;
		occurredAt: Date | null;
		dueAt: Date | null;
		completedAt: Date | null;
		contactId: string | null;
		dealId: string | null;
		createdById: string;
		createdAt: Date;
		meta?: { from: string; to: string };
	};

	const rows: ActivityRow[] = [];

	const base = (createdById: string, createdAt: Date) => ({
		contactId: null,
		dealId: null,
		occurredAt: null,
		dueAt: null,
		completedAt: null,
		subject: null,
		body: null,
		createdById,
		createdAt,
	});

	for (const deal of deals) {
		for (let n = 0; n < integer(3, 6); n++) {
			const at = daysFromNow(-integer(2, 120), 18);
			const type = pick([
				ActivityType.NOTE,
				ActivityType.CALL,
				ActivityType.EMAIL,
				ActivityType.MEETING,
			]);

			rows.push({
				...base(deal.ownerId, at),
				type,
				dealId: deal.id,
				contactId: deal.contactIds.length > 0 ? pick(deal.contactIds) : null,
				subject:
					type === ActivityType.CALL
						? pick(CALL_SUBJECTS)
						: type === ActivityType.MEETING
							? pick(MEETING_SUBJECTS)
							: type === ActivityType.EMAIL
								? pick(EMAIL_SUBJECTS)
								: null,
				body: type === ActivityType.NOTE ? pick(NOTE_BODIES) : null,
				occurredAt: type === ActivityType.NOTE ? null : at,
			});
		}

		rows.push({
			...base(deal.ownerId, daysFromNow(-integer(1, 20), 12)),
			type: ActivityType.STAGE_CHANGE,
			dealId: deal.id,
			subject: "Stage changed",
			meta: {
				from: entryKeyByPipelineId[deal.pipelineId] ?? deal.stageKey,
				to: deal.stageKey,
			},
		});
	}

	for (const deal of deals) {
		if (deal.closed) continue;

		for (let n = 0; n < integer(1, 3); n++) {
			const roll = random();
			const overdue = roll < 0.3;
			const done = roll >= 0.3 && roll < 0.6;
			const dueAt = overdue
				? daysFromNow(-integer(1, 14), 6)
				: daysFromNow(integer(1, 21), 6);

			rows.push({
				...base(deal.ownerId, daysFromNow(-integer(1, 30), 12)),
				type: ActivityType.TASK,
				dealId: deal.id,
				subject: pick(TASK_SUBJECTS),
				dueAt: done ? daysFromNow(-integer(1, 20), 6) : dueAt,
				completedAt: done ? daysFromNow(-integer(1, 10), 6) : null,
			});
		}
	}

	await db.activity.createMany({ data: rows });
	return rows.length;
}

export type DemoSeedResult = {
	stages: number;
	contacts: number;
	deals: number;
	activities: number;
};

export async function seedDemo(): Promise<DemoSeedResult> {
	const stages = await seedPipelines();
	await seedSettings();
	const ownerIds = await seedOwners();
	const contacts = await seedContacts(ownerIds);
	const deals = await seedDeals(contacts, ownerIds, stages);
	const activities = await seedActivities(deals, stages.entryKeyByPipelineId);

	return {
		stages: stages.open.length + stages.closed.length,
		contacts: contacts.length,
		deals: deals.length,
		activities,
	};
}
