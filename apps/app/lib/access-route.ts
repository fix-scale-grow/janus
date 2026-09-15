import { db } from "@crm/db";
import { type AccessPrincipal, allows, hasMoney } from "@crm/db/access-policy";
import { resolvePrincipal } from "@crm/db/access-resolve";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
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

export const JANUS_CHAT_UNAVAILABLE =
	"Janus chat isn't available for your group.";

export function janusChatAllowed(
	p: AccessPrincipal | null,
): p is AccessPrincipal {
	if (!p || p.surface === "FIELD") return false;
	return p.isAdmin || p.groupId !== null;
}

export async function agentRecordsVisible(
	p: AccessPrincipal,
	record: { contactId?: string; dealId?: string; drawingId?: string },
): Promise<boolean> {
	if (record.contactId) {
		if (!allows(p, "contacts", "VIEW")) return false;
		const found = await db.contact.findFirst({
			where: { AND: [{ id: record.contactId }, contactScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) return false;
	}
	if (record.dealId) {
		if (!allows(p, "deals", "VIEW")) return false;
		const found = await db.deal.findFirst({
			where: { AND: [{ id: record.dealId }, dealScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) return false;
	}
	if (record.drawingId) {
		return drawingVisible(p, record.drawingId, "VIEW");
	}
	return true;
}
