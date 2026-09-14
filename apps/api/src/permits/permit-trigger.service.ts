import type { Db } from "@crm/db";
import {
	guessJurisdictionFromAddress,
	parsePlaybookFacts,
} from "@crm/db/permits";
import { readPermitSettings, type UsState } from "@crm/db/settings";
import { Injectable, Logger } from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { FACT_SINGLETON_PATHS } from "./permits.contracts";

@Injectable()
export class PermitTriggerService {
	private readonly logger = new Logger(PermitTriggerService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agentTrigger: AgentTriggerService,
	) {}

	async onStageChanged(dealId: string, stageId: string): Promise<void> {
		try {
			const settings = await readPermitSettings(this.db);
			if (
				!settings.permitsEnabled ||
				!settings.permitTriggerStageIds.includes(stageId)
			) {
				return;
			}

			const existing = await this.db.permit.count({ where: { dealId } });
			if (existing > 0) return;

			const deal = await this.db.deal.findUnique({
				where: { id: dealId },
				select: {
					drawings: {
						select: { address: true },
						orderBy: { updatedAt: "desc" },
						take: 1,
					},
				},
			});
			if (!deal) return;

			const guess = guessJurisdictionFromAddress(
				deal.drawings[0]?.address ?? null,
			);
			if (
				guess &&
				settings.permitStates.length > 0 &&
				!settings.permitStates.includes(guess.state as UsState)
			) {
				return;
			}

			const usable = guess ? await this.hasUsablePlaybook(guess) : false;
			if (usable) return;

			await this.agentTrigger.permitResearchRequested(
				dealId,
				"stage entered a permit trigger",
			);
		} catch (error) {
			this.logger.error(
				{ message: "Permit stage trigger failed", dealId, stageId },
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private async hasUsablePlaybook(guess: {
		name: string;
		state: string;
	}): Promise<boolean> {
		const jurisdiction = await this.db.jurisdiction.findFirst({
			where: {
				state: guess.state,
				name: { equals: guess.name, mode: "insensitive" },
			},
		});
		if (!jurisdiction) return false;

		const playbook =
			(await this.db.permitPlaybook.findFirst({
				where: { jurisdictionId: jurisdiction.id, permitType: "BUILDING" },
			})) ??
			(await this.db.permitPlaybook.findFirst({
				where: { jurisdictionId: jurisdiction.id },
			}));
		if (!playbook) return false;

		const facts = parsePlaybookFacts(playbook.facts);
		const blank =
			FACT_SINGLETON_PATHS.every((path) => facts[path] === null) &&
			facts.requiredDocuments.length === 0 &&
			facts.inspections.length === 0;

		return !blank;
	}
}
