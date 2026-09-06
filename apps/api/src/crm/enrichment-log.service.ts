import { ActivityType, type Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { ActivityStampService } from "./activity-stamp.service";

export type EnrichmentEvent = {
	contactId?: string | null;
	subject: string;
	body?: string | null;
	meta?: Record<string, unknown>;
};

@Injectable()
export class EnrichmentLogService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
	) {}

	async record(event: EnrichmentEvent): Promise<string | null> {
		const author = await this.authorFor(event);
		if (!author) return null;

		const activity = await this.db.activity.create({
			data: {
				type: ActivityType.ENRICHMENT,
				subject: event.subject,
				body: event.body ?? null,
				occurredAt: new Date(),
				contactId: event.contactId ?? null,
				createdById: author,
				meta: { ...event.meta, automated: true },
			},
			select: { id: true, createdAt: true },
		});

		await this.stamp.touch({ contactId: event.contactId }, activity.createdAt);

		return activity.id;
	}

	private async authorFor(event: EnrichmentEvent): Promise<string | null> {
		if (event.contactId) {
			const contact = await this.db.contact.findUnique({
				where: { id: event.contactId },
				select: { ownerId: true },
			});
			if (contact?.ownerId) return contact.ownerId;
		}

		const anyUser = await this.db.user.findFirst({ select: { id: true } });
		return anyUser?.id ?? null;
	}
}

export function describeFilled(fields: readonly string[]): string | null {
	if (fields.length === 0) return null;
	if (fields.length === 1) return `Filled in ${fields[0]}.`;

	const last = fields[fields.length - 1];
	return `Filled in ${fields.slice(0, -1).join(", ")} and ${last}.`;
}
