import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class AgentQueueService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async queuedContacts(ids: readonly string[]): Promise<Set<string>> {
		if (ids.length === 0) return new Set();

		const rows = await this.db.agentTask.findMany({
			where: { finishedAt: null, contactId: { in: [...ids] } },
			select: { contactId: true },
			distinct: ["contactId"],
		});

		return new Set(
			rows
				.map((row) => row.contactId)
				.filter((id): id is string => id !== null),
		);
	}

	async isQueued(subject: { contactId?: string }): Promise<boolean> {
		const row = await this.db.agentTask.findFirst({
			where: {
				finishedAt: null,
				...(subject.contactId ? { contactId: subject.contactId } : {}),
			},
			select: { id: true },
		});

		return row !== null;
	}
}
