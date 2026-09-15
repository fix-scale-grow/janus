import { db } from "@crm/db";
import { type AccessPrincipal, allows } from "@crm/db/access-policy";
import { dealChildWhere } from "@crm/db/access-scope";
import { parseDrawingScale, parseDrawingScene } from "@crm/drawings";
import { summarizeScene } from "./drawing-summary";
import { reviewTakeoff, type TakeoffReviewFacts } from "./takeoff-review";

export type DrawingReviewResult =
	| ({
			found: true;
			drawingId: string;
			estimateId: string | null;
	  } & TakeoffReviewFacts)
	| { found: false; reason: string };

export async function reviewDrawing(
	drawingId: string,
	estimateId: string | undefined,
	p: AccessPrincipal,
): Promise<DrawingReviewResult> {
	const estimateScope = allows(p, "estimates", "VIEW")
		? dealChildWhere(p)
		: { id: { in: [] } };
	const drawing = await db.drawing.findFirst({
		where: { AND: [{ id: drawingId }, dealChildWhere(p)] },
		select: {
			scene: true,
			scale: true,
			estimates: {
				where: estimateId
					? { AND: [{ id: estimateId }, estimateScope] }
					: estimateScope,
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					id: true,
					lineItems: { select: { name: true } },
				},
			},
		},
	});

	if (!drawing) return { found: false, reason: "No such drawing." };

	const [services, symbols] = await Promise.all([
		db.service.findMany({
			where: { active: true },
			select: { id: true, name: true, symbolId: true },
		}),
		db.symbol.findMany({ select: { id: true, serviceId: true } }),
	]);

	const scene = parseDrawingScene(drawing.scene);
	const scale = parseDrawingScale(drawing.scale);
	const { shapes } = summarizeScene(scene, scale, services, symbols);

	const estimate = drawing.estimates[0] ?? null;

	const facts = reviewTakeoff({
		shapes: shapes.map((shape) => ({
			scopeId: shape.scopeId,
			kind: shape.kind,
			label: shape.label,
			service: shape.service,
			hasQuantity: shape.quantity !== null,
		})),
		bookServices: services,
		estimateServiceNames: estimate?.lineItems.map((item) => item.name) ?? [],
	});

	return {
		found: true,
		drawingId,
		estimateId: estimate?.id ?? null,
		...facts,
	};
}
