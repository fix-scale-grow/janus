import type { Db } from "@crm/db";
import type { AccessArea } from "@crm/db/access-config";
import { type AccessPrincipal, allows } from "@crm/db/access-policy";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
} from "@crm/db/access-scope";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { RECENTS } from "./recents.config";
import type { RecentKind, RecentTouchInput } from "./recents.contracts";

const KIND_AREA: Record<RecentKind, AccessArea> = {
	contact: "contacts",
	deal: "deals",
	drawing: "drawings",
	estimate: "estimates",
	invoice: "invoices",
	contract: "contracts",
	project: "projects",
};

export type RecentRow = {
	kind: RecentKind;
	recordId: string;
	touchedAt: Date;
	label: string;
};

function contactLabel(contact: {
	firstName: string;
	lastName: string | null;
}): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

@Injectable()
export class RecentsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(
		userId: string,
		p: AccessPrincipal,
	): Promise<{ rows: RecentRow[] }> {
		const recents = await this.db.recentRecord.findMany({
			where: { userId },
			orderBy: { touchedAt: "desc" },
			take: RECENTS.cap,
			select: { kind: true, recordId: true, touchedAt: true },
		});

		if (recents.length === 0) return { rows: [] };

		const idsByKind = new Map<RecentKind, string[]>();
		for (const entry of recents) {
			const kind = entry.kind as RecentKind;
			const ids = idsByKind.get(kind) ?? [];
			ids.push(entry.recordId);
			idsByKind.set(kind, ids);
		}

		const labelByKey = new Map<string, string>();
		const existingByKey = new Set<string>();

		await Promise.all(
			Array.from(idsByKind.entries()).map(async ([kind, ids]) => {
				const [labels, existingIds] = await Promise.all([
					this.labelsFor(kind, ids, p),
					this.existingIds(kind, ids),
				]);
				for (const [id, label] of labels) {
					labelByKey.set(`${kind}:${id}`, label);
				}
				for (const id of existingIds) {
					existingByKey.add(`${kind}:${id}`);
				}
			}),
		);

		const gone: { kind: RecentKind; recordId: string }[] = [];
		const rows: RecentRow[] = [];

		for (const entry of recents) {
			const kind = entry.kind as RecentKind;
			const key = `${kind}:${entry.recordId}`;
			const label = labelByKey.get(key);
			if (label !== undefined) {
				rows.push({
					kind,
					recordId: entry.recordId,
					touchedAt: entry.touchedAt,
					label,
				});
				continue;
			}
			if (!existingByKey.has(key)) {
				gone.push({ kind, recordId: entry.recordId });
			}
		}

		if (gone.length > 0) {
			await this.db.$transaction(
				gone.map((entry) =>
					this.db.recentRecord.deleteMany({
						where: { userId, kind: entry.kind, recordId: entry.recordId },
					}),
				),
			);
		}

		return { rows };
	}

	async touch(input: RecentTouchInput, p: AccessPrincipal): Promise<void> {
		const inScope = await this.isInScope(input.kind, input.recordId, p);
		if (!inScope) return;

		const userId = p.userId;

		await this.db.recentRecord.upsert({
			where: {
				userId_kind_recordId: {
					userId,
					kind: input.kind,
					recordId: input.recordId,
				},
			},
			create: { userId, kind: input.kind, recordId: input.recordId },
			update: { touchedAt: new Date() },
			select: { id: true },
		});

		const keep = await this.db.recentRecord.findMany({
			where: { userId },
			orderBy: { touchedAt: "desc" },
			take: RECENTS.cap,
			select: { id: true },
		});

		await this.db.recentRecord.deleteMany({
			where: { userId, id: { notIn: keep.map((row) => row.id) } },
		});
	}

	private async isInScope(
		kind: RecentKind,
		id: string,
		p: AccessPrincipal,
	): Promise<boolean> {
		switch (kind) {
			case "contact": {
				const row = await this.db.contact.findFirst({
					where: { AND: [{ id }, contactScopeWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "deal": {
				const row = await this.db.deal.findFirst({
					where: { AND: [{ id }, dealScopeWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "drawing": {
				const row = await this.db.drawing.findFirst({
					where: { AND: [{ id }, dealChildWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "estimate": {
				const row = await this.db.estimate.findFirst({
					where: { AND: [{ id }, dealChildWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "invoice": {
				const row = await this.db.invoice.findFirst({
					where: { AND: [{ id }, dealChildWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "contract": {
				const row = await this.db.contract.findFirst({
					where: { AND: [{ id }, dealChildWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
			case "project": {
				const row = await this.db.project.findFirst({
					where: { AND: [{ id }, dealChildWhere(p)] },
					select: { id: true },
				});
				return row !== null;
			}
		}
	}

	private async existingIds(
		kind: RecentKind,
		ids: string[],
	): Promise<string[]> {
		switch (kind) {
			case "contact": {
				const rows = await this.db.contact.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "deal": {
				const rows = await this.db.deal.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "drawing": {
				const rows = await this.db.drawing.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "estimate": {
				const rows = await this.db.estimate.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "invoice": {
				const rows = await this.db.invoice.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "contract": {
				const rows = await this.db.contract.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
			case "project": {
				const rows = await this.db.project.findMany({
					where: { id: { in: ids } },
					select: { id: true },
				});
				return rows.map((row) => row.id);
			}
		}
	}

	private async labelsFor(
		kind: RecentKind,
		ids: string[],
		p: AccessPrincipal,
	): Promise<Map<string, string>> {
		const labels = new Map<string, string>();

		if (!allows(p, KIND_AREA[kind], "VIEW")) return labels;

		switch (kind) {
			case "contact": {
				const rows = await this.db.contact.findMany({
					where: { AND: [{ id: { in: ids } }, contactScopeWhere(p)] },
					select: { id: true, firstName: true, lastName: true },
				});
				for (const row of rows) labels.set(row.id, contactLabel(row));
				break;
			}
			case "deal": {
				const rows = await this.db.deal.findMany({
					where: { AND: [{ id: { in: ids } }, dealScopeWhere(p)] },
					select: { id: true, name: true, number: true },
				});
				for (const row of rows) {
					labels.set(row.id, `#${row.number} · ${row.name}`);
				}
				break;
			}
			case "drawing": {
				const rows = await this.db.drawing.findMany({
					where: { AND: [{ id: { in: ids } }, dealChildWhere(p)] },
					select: { id: true, title: true },
				});
				for (const row of rows) labels.set(row.id, row.title);
				break;
			}
			case "estimate": {
				const rows = await this.db.estimate.findMany({
					where: { AND: [{ id: { in: ids } }, dealChildWhere(p)] },
					select: { id: true, title: true },
				});
				for (const row of rows) labels.set(row.id, row.title);
				break;
			}
			case "invoice": {
				const rows = await this.db.invoice.findMany({
					where: { AND: [{ id: { in: ids } }, dealChildWhere(p)] },
					select: { id: true, number: true },
				});
				for (const row of rows) labels.set(row.id, `Invoice #${row.number}`);
				break;
			}
			case "contract": {
				const rows = await this.db.contract.findMany({
					where: { AND: [{ id: { in: ids } }, dealChildWhere(p)] },
					select: { id: true, number: true, title: true },
				});
				for (const row of rows) {
					labels.set(row.id, `#${row.number} · ${row.title}`);
				}
				break;
			}
			case "project": {
				const rows = await this.db.project.findMany({
					where: { AND: [{ id: { in: ids } }, dealChildWhere(p)] },
					select: { id: true, name: true },
				});
				for (const row of rows) labels.set(row.id, row.name);
				break;
			}
		}

		return labels;
	}
}
