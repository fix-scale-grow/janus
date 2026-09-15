import { isWorkspaceAdmin, workspaceRoleOf } from "@crm/auth";
import type { Db } from "@crm/db";
import { PERMIT_DISCLAIMER_VERSION } from "@crm/db/permits";
import {
	acceptPermitDisclaimerSetting,
	DEFAULT_AGENT_MODEL,
	type NavLayout,
	type PermitSettings,
	readAgentModel,
	readDealNumberStart,
	readNavLayout,
	readPermitSettings,
	type UsState,
	writeAgentModel,
	writeDealNumberStart,
	writeNavLayout,
	writePermitSettings,
} from "@crm/db/settings";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import {
	type DocumentChrome,
	readDocumentChrome,
	writeDocumentChrome,
} from "../documents/document-chrome";
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

	async documentChrome(): Promise<DocumentChrome> {
		return readDocumentChrome(this.db);
	}

	async setDocumentChrome(
		userId: string,
		chrome: DocumentChrome,
	): Promise<DocumentChrome> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change document layout.",
		);

		await writeDocumentChrome(this.db, chrome);

		this.logger.log({ message: "Document header and footer changed" });

		return this.documentChrome();
	}

	async dealNumbering(): Promise<DealNumberingSettings> {
		const [maxRow, start] = await Promise.all([
			this.db.deal.aggregate({ _max: { number: true } }),
			readDealNumberStart(this.db),
		]);

		const fromExisting = (maxRow._max.number ?? 0) + 1;

		return { nextNumber: start ? Math.max(fromExisting, start) : fromExisting };
	}

	async permits(): Promise<PermitSettings> {
		return readPermitSettings(this.db);
	}

	async setPermits(
		userId: string,
		patch: {
			enabled?: boolean;
			states?: UsState[];
			triggerStageIds?: string[];
		},
	): Promise<PermitSettings> {
		await this.requireAdmin(
			userId,
			"Only an owner or an admin can change permit settings.",
		);

		if (patch.triggerStageIds && patch.triggerStageIds.length > 0) {
			const count = await this.db.stage.count({
				where: { id: { in: patch.triggerStageIds } },
			});

			if (count !== patch.triggerStageIds.length) {
				throw new BadRequestException("Unknown stage");
			}
		}

		const previous = await readPermitSettings(this.db);
		let triggerStageIds = patch.triggerStageIds;

		if (
			patch.enabled === true &&
			!previous.permitsEnabled &&
			previous.permitTriggerStageIds.length === 0 &&
			triggerStageIds === undefined
		) {
			const wonStages = await this.db.stage.findMany({
				where: { outcome: "WON", archivedAt: null },
				select: { id: true },
			});
			triggerStageIds = wonStages.map((stage) => stage.id);
		}

		await writePermitSettings(this.db, {
			permitsEnabled: patch.enabled,
			permitStates: patch.states,
			permitTriggerStageIds: triggerStageIds,
		});

		this.logger.log({ message: "Permit settings changed" });

		return this.permits();
	}

	async acceptPermitDisclaimer(userId: string): Promise<PermitSettings> {
		await acceptPermitDisclaimerSetting(
			this.db,
			userId,
			PERMIT_DISCLAIMER_VERSION,
		);

		this.logger.log({ message: "Permit disclaimer accepted", userId });

		return this.permits();
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
