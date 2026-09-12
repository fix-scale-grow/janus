import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { RECENTS } from "./recents.config";
import type { RecentKind, RecentTouchInput } from "./recents.contracts";

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

	async list(userId: string): Promise<{ rows: RecentRow[] }> {
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

		await Promise.all(
			Array.from(idsByKind.entries()).map(async ([kind, ids]) => {
				const labels = await this.labelsFor(kind, ids);
				for (const [id, label] of labels) {
					labelByKey.set(`${kind}:${id}`, label);
				}
			}),
		);

		const gone: { kind: RecentKind; recordId: string }[] = [];
		const rows: RecentRow[] = [];

		for (const entry of recents) {
			const kind = entry.kind as RecentKind;
			const label = labelByKey.get(`${kind}:${entry.recordId}`);
			if (label === undefined) {
				gone.push({ kind, recordId: entry.recordId });
				continue;
			}
			rows.push({
				kind,
				recordId: entry.recordId,
				touchedAt: entry.touchedAt,
				label,
			});
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

	async touch(input: RecentTouchInput, userId: string): Promise<void> {
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

	private async labelsFor(
		kind: RecentKind,
		ids: string[],
	): Promise<Map<string, string>> {
		const labels = new Map<string, string>();

		switch (kind) {
			case "contact": {
				const rows = await this.db.contact.findMany({
					where: { id: { in: ids } },
					select: { id: true, firstName: true, lastName: true },
				});
				for (const row of rows) labels.set(row.id, contactLabel(row));
				break;
			}
			case "deal": {
				const rows = await this.db.deal.findMany({
					where: { id: { in: ids } },
					select: { id: true, name: true, number: true },
				});
				for (const row of rows) {
					labels.set(row.id, `#${row.number} · ${row.name}`);
				}
				break;
			}
			case "drawing": {
				const rows = await this.db.drawing.findMany({
					where: { id: { in: ids } },
					select: { id: true, title: true },
				});
				for (const row of rows) labels.set(row.id, row.title);
				break;
			}
			case "estimate": {
				const rows = await this.db.estimate.findMany({
					where: { id: { in: ids } },
					select: { id: true, title: true },
				});
				for (const row of rows) labels.set(row.id, row.title);
				break;
			}
			case "invoice": {
				const rows = await this.db.invoice.findMany({
					where: { id: { in: ids } },
					select: { id: true, number: true },
				});
				for (const row of rows) labels.set(row.id, `Invoice #${row.number}`);
				break;
			}
			case "contract": {
				const rows = await this.db.contract.findMany({
					where: { id: { in: ids } },
					select: { id: true, number: true, title: true },
				});
				for (const row of rows) {
					labels.set(row.id, `#${row.number} · ${row.title}`);
				}
				break;
			}
			case "project": {
				const rows = await this.db.project.findMany({
					where: { id: { in: ids } },
					select: { id: true, name: true },
				});
				for (const row of rows) labels.set(row.id, row.name);
				break;
			}
		}

		return labels;
	}
}
