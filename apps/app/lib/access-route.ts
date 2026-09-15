import { db } from "@crm/db";
import { type AccessPrincipal, allows, hasMoney } from "@crm/db/access-policy";
import { resolvePrincipal } from "@crm/db/access-resolve";
import {
	dealChildWhere,
	photoScopeWhere,
	requiredDealChildWhere,
} from "@crm/db/access-scope";

export async function routePrincipal(
	userId: string,
): Promise<AccessPrincipal | null> {
	return resolvePrincipal(db, userId);
}

export async function photoVisible(
	p: AccessPrincipal,
	photoId: string,
	need: "VIEW" | "EDIT" | "DELETE" = "VIEW",
): Promise<boolean> {
	if (!allows(p, "photos", need)) return false;
	const found = await db.photo.findFirst({
		where: { AND: [{ id: photoId }, photoScopeWhere(p)] },
		select: { id: true },
	});
	return found !== null;
}

export async function costVisible(
	p: AccessPrincipal,
	costId: string,
	need: "view" | "submit" | "delete",
): Promise<boolean> {
	const ok =
		need === "view"
			? allows(p, "jobCosts", "VIEW") && hasMoney(p, "profit")
			: need === "delete"
				? allows(p, "jobCosts", "EDIT")
				: allows(p, "jobCosts", ["EDIT", "jobCosts.submit"]);
	if (!ok) return false;
	const found = await db.jobCost.findFirst({
		where: { AND: [{ id: costId }, requiredDealChildWhere(p)] },
		select: { id: true },
	});
	return found !== null;
}

export async function drawingVisible(
	p: AccessPrincipal,
	drawingId: string,
	need: "VIEW" | "EDIT",
): Promise<boolean> {
	if (!allows(p, "drawings", need)) return false;
	const found = await db.drawing.findFirst({
		where: { AND: [{ id: drawingId }, dealChildWhere(p)] },
		select: { id: true },
	});
	return found !== null;
}

export async function permitDocumentVisible(
	p: AccessPrincipal,
	documentId: string,
	need: "VIEW" | "EDIT",
): Promise<boolean> {
	if (!allows(p, "permits", need)) return false;
	const found = await db.permitDocument.findFirst({
		where: { AND: [{ id: documentId }, { permit: requiredDealChildWhere(p) }] },
		select: { id: true },
	});
	return found !== null;
}
