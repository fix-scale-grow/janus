import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import type { Db } from "@crm/db";
import {
	DEFAULT_AGENT_MODEL,
	maskKey,
	type NavLayout,
	readAgentModel,
	readContextDevKey,
	readDealNumberStart,
	readNavLayout,
	writeAgentModel,
	writeContextDevKey,
	writeDealNumberStart,
	writeNavLayout,
} from "@crm/db/settings";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
} from "@nestjs/common";
import { ResearchKeyService } from "../agent/research-key.service";
import { BackfillService } from "../backfill/backfill.service";
import { InjectDatabase } from "../database/database.constants";
import {
	type CatalogModel,
	ModelCatalogService,
} from "./model-catalog.service";

export interface AgentModelSettings {
	selectedId: string | null;
	effectiveId: string;
	defaultId: string;
	effective: CatalogModel | null;
	updatedAt: string | null;
}

export interface ModelCatalogResult {
	models: CatalogModel[];
	available: boolean;
}

export interface ResearchKeySettings {
	configured: boolean;
	hint: string | null;
}

export interface NavLayoutSettings {
	layout: NavLayout;
}

export interface DealNumberingSettings {
	nextNumber: number;
}

@Injectable()
export class SettingsService {
	private readonly logger = new Logger(SettingsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly catalog: ModelCatalogService,
		private readonly researchKeys: ResearchKeyService,
		private readonly backfill: BackfillService,
	) {}

	async agentModel(): Promise<AgentModelSettings> {
		const [model, row] = await Promise.all([
			readAgentModel(this.db),
			this.db.appSetting.findFirst({ select: { updatedAt: true } }),
		]);

		return {
			selectedId: model.isDefault ? null : model.id,
			effectiveId: model.id,
			defaultId: DEFAULT_AGENT_MODEL.id,
			effective: await this.catalog.find(model.id),
			updatedAt: row?.updatedAt.toISOString() ?? null,
		};
	}

	async setAgentModel(modelId: string | null): Promise<AgentModelSettings> {
		if (modelId === null) {
			await writeAgentModel(this.db, null);
			this.logger.log({ message: "Agent model reset to the default" });
			return this.agentModel();
		}

		const models = await this.catalog.models();

		if (!models) {
			throw new BadRequestException(
				"Could not reach the AI Gateway to check that model. Try again in a moment.",
			);
		}

		const chosen = models.find((model) => model.id === modelId);

		if (!chosen) {
			throw new BadRequestException(
				`The AI Gateway does not serve a tool-using model called "${modelId}".`,
			);
		}

		await writeAgentModel(this.db, {
			id: chosen.id,
			contextWindowTokens: chosen.contextWindowTokens,
		});

		this.logger.log({ message: "Agent model changed", modelId: chosen.id });

		return this.agentModel();
	}

	async modelCatalog(): Promise<ModelCatalogResult> {
		const models = await this.catalog.models();
		return { models: models ?? [], available: models !== null };
	}

	async researchKey(): Promise<ResearchKeySettings> {
		const key = await readContextDevKey(this.db);

		return { configured: key !== null, hint: key ? maskKey(key) : null };
	}

	async setResearchKey(apiKey: string): Promise<ResearchKeySettings> {
		const check = await this.researchKeys.verify(apiKey);

		if (check.outcome === "invalid") {
			throw new BadRequestException(check.reason);
		}

		await writeContextDevKey(this.db, apiKey);

		this.logger.log({
			message: "Context key saved",
			verified: check.outcome === "valid",
		});

		void this.backfill
			.run("contacts")
			.then(({ queued, remaining }) => {
				if (queued > 0) {
					this.logger.log({
						message: "Queued the research that was waiting on a key",
						queued,
						remaining,
					});
				}
			})
			.catch((error: unknown) => {
				this.logger.warn(
					{ message: "Could not queue the waiting research" },
					error instanceof Error ? error.stack : String(error),
				);
			});

		return this.researchKey();
	}

	private async requireAdmin(userId: string, message: string): Promise<void> {
		if (!isWorkspaceAdmin(await workspaceRoleOf(userId))) {
			throw new ForbiddenException(message);
		}
	}

	async navLayout(): Promise<NavLayoutSettings> {
		return { layout: await readNavLayout(this.db) };
	}

	async setNavLayout(
		userId: string,
		layout: NavLayout,
	): Promise<NavLayoutSettings> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change the navigation layout.",
		);

		await writeNavLayout(this.db, layout);

		this.logger.log({ message: "Nav layout changed", layout });

		return this.navLayout();
	}

	async dealNumbering(): Promise<DealNumberingSettings> {
		const [maxRow, start] = await Promise.all([
			this.db.deal.aggregate({ _max: { number: true } }),
			readDealNumberStart(this.db),
		]);

		const fromExisting = (maxRow._max.number ?? 0) + 1;

		return { nextNumber: start ? Math.max(fromExisting, start) : fromExisting };
	}

	async setDealNumberStart(
		userId: string,
		start: number,
	): Promise<DealNumberingSettings> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change job numbering.",
		);

		const maxRow = await this.db.deal.aggregate({ _max: { number: true } });
		const max = maxRow._max.number ?? 0;

		if (start <= max) {
			throw new BadRequestException(
				`Job numbers can only move forward. The highest number is ${max}.`,
			);
		}

		if (start - 1 >= 1) {
			await this.db
				.$executeRaw`SELECT setval(pg_get_serial_sequence('"deal"', 'number'), ${start - 1})`;
		}

		await writeDealNumberStart(this.db, start);

		this.logger.log({ message: "Deal number start changed", start });

		return this.dealNumbering();
	}
}
