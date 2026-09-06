import { isDeepStrictEqual } from "node:util";
import { db, Prisma } from "@crm/db";
import { parseServiceModifier, type ServiceModifier } from "@crm/drawings";

export const SERVICE_WRITES = {
	limits: {
		maxName: 200,
		maxCents: 99_999_999,
	},
} as const;

export type ServiceFieldValues = {
	name?: string;
	unitPriceCents?: number;
	priceGoodCents?: number | null;
	priceBestCents?: number | null;
	modifier?: ServiceModifier | null;
};

export type ServiceSnapshot = Required<ServiceFieldValues>;

export type ServiceDiffEntry = {
	field: keyof ServiceFieldValues;
	from: unknown;
	to: unknown;
};

export type ApplyServiceUpdateResult =
	| { applied: true; serviceId: string; diff: ServiceDiffEntry[] }
	| { applied: false; reason: string };

const FIELD_ORDER: (keyof ServiceFieldValues)[] = [
	"name",
	"unitPriceCents",
	"priceGoodCents",
	"priceBestCents",
	"modifier",
];

export async function applyServiceUpdate(
	serviceId: string,
	current: ServiceSnapshot,
	changes: ServiceFieldValues,
): Promise<ApplyServiceUpdateResult> {
	const service = await db.service.findUnique({ where: { id: serviceId } });
	if (!service) return { applied: false, reason: "No such service." };

	const live: ServiceSnapshot = {
		name: service.name,
		unitPriceCents: service.unitPriceCents,
		priceGoodCents: service.priceGoodCents,
		priceBestCents: service.priceBestCents,
		modifier: parseServiceModifier(service.modifier),
	};

	const changedFields = FIELD_ORDER.filter((field) => field in changes);

	const stale = changedFields.find(
		(field) => !isDeepStrictEqual(current[field], live[field]),
	);
	if (stale) {
		return {
			applied: false,
			reason: `The current ${stale} on the book has changed since it was read. Re-read the price book and try again.`,
		};
	}

	const diff: ServiceDiffEntry[] = changedFields
		.filter((field) => !isDeepStrictEqual(live[field], changes[field]))
		.map((field) => ({ field, from: live[field], to: changes[field] }));

	if (diff.length === 0) {
		return { applied: false, reason: "Nothing to change." };
	}

	const data: Prisma.ServiceUpdateInput = {};
	if (changes.name !== undefined) data.name = changes.name;
	if (changes.unitPriceCents !== undefined) {
		data.unitPriceCents = changes.unitPriceCents;
	}
	if (changes.priceGoodCents !== undefined) {
		data.priceGoodCents = changes.priceGoodCents;
	}
	if (changes.priceBestCents !== undefined) {
		data.priceBestCents = changes.priceBestCents;
	}
	if (changes.modifier !== undefined) {
		data.modifier =
			changes.modifier === null
				? Prisma.JsonNull
				: (changes.modifier as Prisma.InputJsonValue);
	}

	await db.service.update({ where: { id: serviceId }, data });

	return { applied: true, serviceId, diff };
}
