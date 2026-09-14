import type { Db } from "./client";
import {
	DEFAULT_REPORTING_CURRENCY,
	isCurrencyCode,
	normalizeCurrency,
} from "./currency";
import { PERMIT_DISCLAIMER_VERSION } from "./permits";

export const SETTINGS_ID = "app";

export const DEFAULT_AGENT_MODEL = {
	id: "zai/glm-5.2-fast",
	contextWindowTokens: 1_000_000,
} as const;

export interface AgentModelSetting {
	id: string;
	contextWindowTokens: number;
	isDefault: boolean;
}

export async function readAgentModel(db: Db): Promise<AgentModelSetting> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { agentModelId: true, agentModelContextWindow: true },
	});

	if (!row?.agentModelId) {
		return { ...DEFAULT_AGENT_MODEL, isDefault: true };
	}

	return {
		id: row.agentModelId,
		contextWindowTokens:
			row.agentModelContextWindow ?? DEFAULT_AGENT_MODEL.contextWindowTokens,
		isDefault: false,
	};
}

export async function writeAgentModel(
	db: Db,
	model: { id: string; contextWindowTokens: number } | null,
): Promise<void> {
	const fields = {
		agentModelId: model?.id ?? null,
		agentModelContextWindow: model?.contextWindowTokens ?? null,
	};

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});
}

export const CONTEXT_DEV_SIGNUP_URL = "https://link.context.dev/crm";

export const CONTEXT_DEV_DISCOUNT_CODE = "CRM";

export async function readContextDevKey(db: Db): Promise<string | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { contextDevApiKey: true },
	});

	return row?.contextDevApiKey?.trim() || null;
}

export async function writeContextDevKey(db: Db, key: string): Promise<void> {
	const contextDevApiKey = key.trim();

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, contextDevApiKey },
		update: { contextDevApiKey },
	});
}

export async function readReportingCurrency(db: Db): Promise<string> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});

	const stored = normalizeCurrency(row?.reportingCurrency);

	return isCurrencyCode(stored) ? stored : DEFAULT_REPORTING_CURRENCY;
}

export async function writeReportingCurrency(
	db: Db,
	code: string,
): Promise<string> {
	const reportingCurrency = normalizeCurrency(code);

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, reportingCurrency },
		update: { reportingCurrency },
	});

	return reportingCurrency;
}

export async function readRatesRefreshedAt(db: Db): Promise<Date | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { ratesRefreshedAt: true },
	});

	return row?.ratesRefreshedAt ?? null;
}

export async function writeRatesRefreshedAt(
	db: Db,
	ratesRefreshedAt: Date,
): Promise<void> {
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ratesRefreshedAt },
		update: { ratesRefreshedAt },
	});
}

export const NAV_LAYOUTS = ["RAIL", "TOP_BAR"] as const;

export type NavLayout = (typeof NAV_LAYOUTS)[number];

export const DEFAULT_NAV_LAYOUT: NavLayout = "RAIL";

export async function readNavLayout(db: Db): Promise<NavLayout> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { navLayout: true },
	});

	return row?.navLayout === "TOP_BAR" ? "TOP_BAR" : DEFAULT_NAV_LAYOUT;
}

export async function writeNavLayout(
	db: Db,
	navLayout: NavLayout,
): Promise<void> {
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, navLayout },
		update: { navLayout },
	});
}

export async function readDealNumberStart(db: Db): Promise<number | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { dealNumberStart: true },
	});

	return row?.dealNumberStart ?? null;
}

export async function writeDealNumberStart(
	db: Db,
	dealNumberStart: number,
): Promise<void> {
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, dealNumberStart },
		update: { dealNumberStart },
	});
}

export const US_STATES = [
	"AL",
	"AK",
	"AZ",
	"AR",
	"CA",
	"CO",
	"CT",
	"DE",
	"FL",
	"GA",
	"HI",
	"ID",
	"IL",
	"IN",
	"IA",
	"KS",
	"KY",
	"LA",
	"ME",
	"MD",
	"MA",
	"MI",
	"MN",
	"MS",
	"MO",
	"MT",
	"NE",
	"NV",
	"NH",
	"NJ",
	"NM",
	"NY",
	"NC",
	"ND",
	"OH",
	"OK",
	"OR",
	"PA",
	"RI",
	"SC",
	"SD",
	"TN",
	"TX",
	"UT",
	"VT",
	"VA",
	"WA",
	"WV",
	"WI",
	"WY",
	"DC",
	"AS",
	"GU",
	"MP",
	"PR",
	"VI",
] as const;

export type UsState = (typeof US_STATES)[number];

export interface PermitDisclaimerSetting {
	acceptedById: string;
	acceptedAt: Date;
	version: number;
}

export interface PermitSettings {
	permitsEnabled: boolean;
	permitStates: UsState[];
	permitTriggerStageIds: string[];
	disclaimer: PermitDisclaimerSetting | null;
}

export interface PermitSettingsPatch {
	permitsEnabled?: boolean;
	permitStates?: UsState[];
	permitTriggerStageIds?: string[];
}

export async function readPermitSettings(db: Db): Promise<PermitSettings> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			permitsEnabled: true,
			permitStates: true,
			permitTriggerStageIds: true,
			permitDisclaimerVersion: true,
			permitDisclaimerAcceptedById: true,
			permitDisclaimerAcceptedAt: true,
		},
	});

	const disclaimer =
		row?.permitDisclaimerVersion != null &&
		row.permitDisclaimerAcceptedById != null &&
		row.permitDisclaimerAcceptedAt != null
			? {
					acceptedById: row.permitDisclaimerAcceptedById,
					acceptedAt: row.permitDisclaimerAcceptedAt,
					version: row.permitDisclaimerVersion,
				}
			: null;

	return {
		permitsEnabled: row?.permitsEnabled ?? false,
		permitStates: (row?.permitStates ?? []) as UsState[],
		permitTriggerStageIds: row?.permitTriggerStageIds ?? [],
		disclaimer,
	};
}

export async function writePermitSettings(
	db: Db,
	patch: PermitSettingsPatch,
): Promise<void> {
	const fields = {
		...(patch.permitsEnabled !== undefined && {
			permitsEnabled: patch.permitsEnabled,
		}),
		...(patch.permitStates !== undefined && {
			permitStates: patch.permitStates,
		}),
		...(patch.permitTriggerStageIds !== undefined && {
			permitTriggerStageIds: patch.permitTriggerStageIds,
		}),
	};

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});
}

export async function acceptPermitDisclaimerSetting(
	db: Db,
	userId: string,
	version: number,
): Promise<PermitDisclaimerSetting> {
	const existing = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			permitDisclaimerVersion: true,
			permitDisclaimerAcceptedById: true,
			permitDisclaimerAcceptedAt: true,
		},
	});

	if (
		existing?.permitDisclaimerVersion === version &&
		existing.permitDisclaimerAcceptedById != null &&
		existing.permitDisclaimerAcceptedAt != null
	) {
		return {
			acceptedById: existing.permitDisclaimerAcceptedById,
			acceptedAt: existing.permitDisclaimerAcceptedAt,
			version: existing.permitDisclaimerVersion,
		};
	}

	const acceptedAt = new Date();
	const fields = {
		permitDisclaimerVersion: version,
		permitDisclaimerAcceptedById: userId,
		permitDisclaimerAcceptedAt: acceptedAt,
	};

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});

	return { acceptedById: userId, acceptedAt, version };
}

export function isPermitDisclaimerAccepted(
	disclaimer: PermitDisclaimerSetting | null,
): boolean {
	return (
		disclaimer !== null && disclaimer.version === PERMIT_DISCLAIMER_VERSION
	);
}

export function maskKey(key: string): string {
	const trimmed = key.trim();
	return trimmed.length > 4 ? `••••${trimmed.slice(-4)}` : "••••";
}
