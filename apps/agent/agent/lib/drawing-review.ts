import { db } from "@crm/db";
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
): Promise<DrawingReviewResult> {
	const drawing = await db.drawing.findUnique({
		where: { id: drawingId },
		select: {
			scene: true,
			scale: true,
			estimates: {
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
