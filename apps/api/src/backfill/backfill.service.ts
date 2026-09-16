import { onSignedIn } from "@crm/auth";
import { type Db, EnrichmentStatus, type Prisma } from "@crm/db";
import { readWorkspaceIdentity } from "@crm/db/workspace";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { ImageMirrorService } from "./image-mirror.service";

export type BackfillScope = "contacts";

export type BackfillResult = {
	queued: number;
	alreadyQueued: number;
	remaining: number;
	iconsResolving: number;
};

const MAX_PER_RUN = 500;

const NEVER_SUCCEEDED: Prisma.EnumEnrichmentStatusFilter = {
	in: [EnrichmentStatus.PENDING, EnrichmentStatus.FAILED],
};

const AUTO_KEY = "backfill:auto";

const AUTO_EVERY_MS = 5 * 60_000;

const RECHECK_WORKSPACE_AFTER_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class BackfillService implements OnModuleInit {
	private readonly logger = new Logger(BackfillService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly images: ImageMirrorService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {}

	onModuleInit(): void {
		onSignedIn(() => {
			void this.auto();
		});
	}

	async auto(): Promise<{ started: boolean }> {
		if (await this.cache.get(AUTO_KEY)) return { started: false };
		await this.cache.set(AUTO_KEY, true, AUTO_EVERY_MS);

		void (async () => {
			try {
				await this.sweepWorkspace();

				const contacts = await this.runContacts();

				const mirrored = await this.images.sweep();

				this.logger.log({
					message: "Automatic backfill swept",
					queued: contacts.queued,
					remaining: contacts.remaining,
					imagesMirrored: mirrored.copied,
				});
			} catch (error) {
				this.logger.error(
					{ message: "Automatic backfill failed" },
					error instanceof Error ? error.stack : String(error),
				);
			}
		})();

		return { started: true };
	}

	private async sweepWorkspace(): Promise<void> {
		const us = await readWorkspaceIdentity(this.db);

		if (!us?.website || us.profile) return;

		const attempted = await this.db.agentTask.findFirst({
			where: {
				kind: "workspace-profile",
				finishedAt: { gte: new Date(Date.now() - RECHECK_WORKSPACE_AFTER_MS) },
			},
			select: { id: true },
		});

		if (attempted) return;

		await this.agent.workspaceChanged(
			us.website,
			"We still have no profile of the company using this CRM",
		);
	}

	async run(scope: BackfillScope): Promise<BackfillResult> {
		void scope;
		return this.runContacts();
	}

	private async runContacts(): Promise<BackfillResult> {
		const [researchTotal, researchRows] = await Promise.all([
			this.db.contact.count({ where: this.contactsNeverResearched() }),
			this.db.contact.findMany({
				where: this.contactsNeverResearched(),
				orderBy: { createdAt: "asc" },
				take: MAX_PER_RUN,
				select: { id: true },
			}),
		]);

		const research = await this.agent.backfill({
			kind: "identify",
			reason: "Backfill — this contact was never researched",
			contactIds: researchRows.map((row) => row.id),
		});

		return {
			queued: research.queued,
			alreadyQueued: research.alreadyQueued,
			remaining: Math.max(0, researchTotal - researchRows.length),
			iconsResolving: 0,
		};
	}

	private contactsNeverResearched(): Prisma.ContactWhereInput {
		return { enrichmentStatus: NEVER_SUCCEEDED };
	}
}
