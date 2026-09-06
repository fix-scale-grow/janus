import { db, type ServiceUnit } from "@crm/db";

export type ProposedEstimateLine = {
	serviceId?: string;
	name: string;
	unit: ServiceUnit;
	quantity: number;
};

export type ApplyEstimateLinesResult =
	| { applied: true; estimateId: string; lineItemIds: string[] }
	| { applied: false; reason: string };

export async function applyEstimateLines(
	estimateId: string,
	lines: ProposedEstimateLine[],
): Promise<ApplyEstimateLinesResult> {
	const estimate = await db.estimate.findUnique({
		where: { id: estimateId },
		select: { id: true },
	});
	if (!estimate) return { applied: false, reason: "No such estimate." };

	const serviceIds = [
		...new Set(
			lines.flatMap((line) => (line.serviceId ? [line.serviceId] : [])),
		),
	];

	const services =
		serviceIds.length > 0
			? await db.service.findMany({ where: { id: { in: serviceIds } } })
			: [];
	const serviceById = new Map(services.map((service) => [service.id, service]));

	const missingServiceId = serviceIds.find((id) => !serviceById.has(id));
	if (missingServiceId) {
		return {
			applied: false,
			reason: `No service with id ${missingServiceId}.`,
		};
	}

	const lineItemIds = await db.$transaction(async (tx) => {
		const startingSortOrder = await tx.estimateLineItem.count({
			where: { estimateId },
		});

		const created = [];
		for (const [index, line] of lines.entries()) {
			const service = line.serviceId
				? serviceById.get(line.serviceId)
				: undefined;

			const row = await tx.estimateLineItem.create({
				data: {
					estimateId,
					serviceId: service?.id,
					name: service ? service.name : line.name,
					unit: service ? service.unit : line.unit,
					quantity: line.quantity,
					priceGoodCents: service
						? (service.priceGoodCents ?? service.unitPriceCents)
						: 0,
					priceBetterCents: service ? service.unitPriceCents : 0,
					priceBestCents: service
						? (service.priceBestCents ?? service.unitPriceCents)
						: 0,
					sortOrder: startingSortOrder + index,
				},
				select: { id: true },
			});
			created.push(row.id);
		}

		return created;
	});

	return { applied: true, estimateId, lineItemIds };
}
