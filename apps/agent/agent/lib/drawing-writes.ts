import { db, type Prisma } from "@crm/db";
import {
	DRAWINGS,
	type DrawingScene,
	isSceneTooLarge,
	parseDrawingScale,
	parseDrawingScene,
	scopeCustomData,
} from "@crm/drawings";

export type ServiceTag = {
	scopeId: string;
	serviceId: string;
};

export type MergeResult = {
	scene: DrawingScene;
	matched: string[];
	unmatched: string[];
};

export function mergeServiceTags(
	scene: DrawingScene,
	tags: ServiceTag[],
): MergeResult {
	const byScopeId = new Map(tags.map((tag) => [tag.scopeId, tag.serviceId]));
	const matched = new Set<string>();

	const elements = scene.excalidraw.elements.map((element) => {
		if (!element.customData) return element;
		const parsed = scopeCustomData.safeParse(element.customData);
		if (!parsed.success) return element;
		const serviceId = byScopeId.get(parsed.data.scopeId);
		if (serviceId === undefined) return element;
		matched.add(parsed.data.scopeId);
		return {
			...element,
			customData: { ...element.customData, serviceId },
		};
	});

	const satellite = scene.satellite
		? {
				...scene.satellite,
				features: scene.satellite.features.map((feature) => {
					if (!feature.scope) return feature;
					const serviceId = byScopeId.get(feature.scope.scopeId);
					if (serviceId === undefined) return feature;
					matched.add(feature.scope.scopeId);
					return { ...feature, scope: { ...feature.scope, serviceId } };
				}),
			}
		: null;

	const unmatched = tags
		.map((tag) => tag.scopeId)
		.filter((scopeId) => !matched.has(scopeId));

	return {
		scene: { excalidraw: { ...scene.excalidraw, elements }, satellite },
		matched: [...matched],
		unmatched,
	};
}

export type ApplyTagsResult =
	| {
			applied: true;
			drawingId: string;
			matched: string[];
			unmatched: string[];
	  }
	| { applied: false; reason: string };

export async function applyDrawingTags(
	drawingId: string,
	tags: ServiceTag[],
): Promise<ApplyTagsResult> {
	const drawing = await db.drawing.findUnique({
		where: { id: drawingId },
		select: { scene: true, scale: true },
	});
	if (!drawing) return { applied: false, reason: "No such drawing." };

	const scene = parseDrawingScene(drawing.scene);
	const scale = parseDrawingScale(drawing.scale);
	const result = mergeServiceTags(scene, tags);

	if (result.matched.length === 0) {
		return {
			applied: false,
			reason: "None of the proposed tags matched a shape on this drawing.",
		};
	}

	if (isSceneTooLarge(result.scene)) {
		return {
			applied: false,
			reason: "Applying these tags would push the drawing over its size limit.",
		};
	}

	await db.$transaction(async (tx) => {
		await tx.drawing.update({
			where: { id: drawingId },
			data: {
				scene: result.scene as Prisma.InputJsonValue,
				sceneUpdatedAt: new Date(),
			},
		});

		await tx.drawingVersion.create({
			data: {
				drawingId,
				scene: result.scene as Prisma.InputJsonValue,
				scale: (scale ?? undefined) as Prisma.InputJsonValue | undefined,
			},
		});

		await pruneVersions(tx, drawingId);
	});

	return {
		applied: true,
		drawingId,
		matched: result.matched,
		unmatched: result.unmatched,
	};
}

export type AttachDrawingInput = {
	drawingId: string;
	dealId?: string | null;
	contactId?: string | null;
	confirmReplace?: boolean;
};

export type AttachDrawingResult =
	| {
			attached: true;
			drawingId: string;
			dealId: string | null;
			contactId: string | null;
	  }
	| { attached: false; reason: string };

export async function attachDrawing(
	input: AttachDrawingInput,
): Promise<AttachDrawingResult> {
	const drawing = await db.drawing.findUnique({
		where: { id: input.drawingId },
		select: { dealId: true, contactId: true },
	});
	if (!drawing) return { attached: false, reason: "No such drawing." };

	const wantsDeal = input.dealId !== undefined;
	const wantsContact = input.contactId !== undefined;
	if (!wantsDeal && !wantsContact) {
		return {
			attached: false,
			reason: "Nothing to change. Pass dealId or contactId.",
		};
	}

	const conflicts: string[] = [];
	if (
		wantsDeal &&
		drawing.dealId &&
		drawing.dealId !== input.dealId &&
		!input.confirmReplace
	) {
		conflicts.push("deal");
	}
	if (
		wantsContact &&
		drawing.contactId &&
		drawing.contactId !== input.contactId &&
		!input.confirmReplace
	) {
		conflicts.push("contact");
	}
	if (conflicts.length > 0) {
		return {
			attached: false,
			reason: `This drawing already belongs to a different ${conflicts.join(" and ")}. Ask the rep whether to move it, then call again with confirmReplace: true.`,
		};
	}

	if (wantsDeal && input.dealId) {
		const deal = await db.deal.findUnique({
			where: { id: input.dealId },
			select: { id: true },
		});
		if (!deal) return { attached: false, reason: "No such deal." };
	}
	if (wantsContact && input.contactId) {
		const contact = await db.contact.findUnique({
			where: { id: input.contactId },
			select: { id: true },
		});
		if (!contact) return { attached: false, reason: "No such contact." };
	}

	const updated = await db.drawing.update({
		where: { id: input.drawingId },
		data: {
			...(wantsDeal ? { dealId: input.dealId } : {}),
			...(wantsContact ? { contactId: input.contactId } : {}),
		},
		select: { id: true, dealId: true, contactId: true },
	});

	return {
		attached: true,
		drawingId: updated.id,
		dealId: updated.dealId,
		contactId: updated.contactId,
	};
}

async function pruneVersions(
	tx: Prisma.TransactionClient,
	drawingId: string,
): Promise<void> {
	const stale = await tx.drawingVersion.findMany({
		where: { drawingId },
		orderBy: { createdAt: "desc" },
		skip: DRAWINGS.limits.maxVersions,
		select: { id: true },
	});

	if (stale.length === 0) return;

	await tx.drawingVersion.deleteMany({
		where: { id: { in: stale.map((version) => version.id) } },
	});
}
