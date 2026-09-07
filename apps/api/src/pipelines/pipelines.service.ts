import {
	type Db,
	type PipelineModel as Pipeline,
	type Prisma,
	Prisma as PrismaNamespace,
	type StageModel as Stage,
	StageOutcome,
} from "@crm/db";
import { fieldKeyFromLabel } from "@crm/db/fields-shape";
import { STAGE_SWATCHES } from "@crm/db/stage-semantics";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { NEW_PIPELINE_STAGES } from "./pipelines.config";
import type {
	PipelineReorderInput,
	PipelineUpdateData,
	StageCreateInput,
	StageReorderInput,
	StageUpdateData,
} from "./pipelines.contracts";

export type PipelineWithStages = Pipeline & { stages: Stage[] };

const WITH_STAGES = {
	stages: { orderBy: { position: "asc" } },
} as const satisfies Prisma.PipelineInclude;

const WITH_STAGES_ALL = {
	stages: { orderBy: { position: "asc" }, where: {} },
} as const satisfies Prisma.PipelineInclude;

const BATCH_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

@Injectable()
export class PipelinesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(includeArchived: boolean): Promise<PipelineWithStages[]> {
		return this.db.pipeline.findMany({
			where: includeArchived ? {} : { archivedAt: null },
			include: includeArchived
				? WITH_STAGES_ALL
				: {
						stages: {
							where: { archivedAt: null },
							orderBy: { position: "asc" },
						},
					},
			orderBy: { position: "asc" },
		});
	}

	async createPipeline(name: string): Promise<PipelineWithStages> {
		const last = await this.db.pipeline.findFirst({
			orderBy: { position: "desc" },
			select: { position: true },
		});

		return this.db.pipeline.create({
			data: {
				name,
				position: (last?.position ?? -1) + 1,
				stages: {
					create: NEW_PIPELINE_STAGES.map((stage, index) => ({
						key: this.uniqueKeySync(stage.label, []),
						label: stage.label,
						color: stage.color,
						outcome: stage.outcome,
						isEntry: stage.isEntry,
						position: index,
					})),
				},
			},
			include: WITH_STAGES,
		});
	}

	async updatePipeline(
		id: string,
		data: PipelineUpdateData,
	): Promise<Pipeline> {
		try {
			return await this.db.pipeline.update({ where: { id }, data });
		} catch (error) {
			throw this.translate(error, "pipeline");
		}
	}

	async reorderPipelines(
		input: PipelineReorderInput,
	): Promise<PipelineWithStages[]> {
		const owned = await this.db.pipeline.findMany({
			where: { id: { in: input.ids } },
			select: { id: true },
		});

		if (owned.length !== input.ids.length) {
			throw new BadRequestException(
				"That order names a pipeline that does not exist.",
			);
		}

		await this.db.$transaction(
			input.ids.map((id, index) =>
				this.db.pipeline.update({ where: { id }, data: { position: index } }),
			),
			BATCH_OPTIONS,
		);

		return this.list(false);
	}

	async archivePipeline(id: string): Promise<Pipeline> {
		const pipeline = await this.db.pipeline.findUnique({ where: { id } });

		if (!pipeline) throw new NotFoundException("That pipeline does not exist.");

		const openDeals = await this.db.deal.count({
			where: { stage: { pipelineId: id, outcome: StageOutcome.OPEN } },
		});

		if (openDeals > 0) {
			throw new BadRequestException(
				"This pipeline still has open deals. Close or move them first.",
			);
		}

		return this.db.pipeline.update({
			where: { id },
			data: { archivedAt: new Date() },
		});
	}

	async restorePipeline(id: string): Promise<Pipeline> {
		try {
			return await this.db.pipeline.update({
				where: { id },
				data: { archivedAt: null },
			});
		} catch (error) {
			throw this.translate(error, "pipeline");
		}
	}

	async createStage(input: StageCreateInput): Promise<Stage> {
		this.guardColor(input.color);

		const pipeline = await this.db.pipeline.findUnique({
			where: { id: input.pipelineId },
			select: { id: true },
		});

		if (!pipeline) {
			throw new BadRequestException("That pipeline does not exist.");
		}

		const existing = await this.db.stage.findMany({
			where: { pipelineId: input.pipelineId },
			select: { key: true },
		});

		const key = uniqueKey(
			input.label,
			existing.map((row) => row.key),
		);

		const ordered = await this.db.stage.findMany({
			where: { pipelineId: input.pipelineId, archivedAt: null },
			orderBy: { position: "asc" },
			select: { id: true, position: true },
		});

		const position = Math.min(
			Math.max(input.position ?? ordered.length, 0),
			ordered.length,
		);

		const toShift = ordered.slice(position);

		for (const stage of toShift) {
			await this.db.stage.update({
				where: { id: stage.id },
				data: { position: stage.position + 1 },
			});
		}

		return this.db.stage.create({
			data: {
				pipelineId: input.pipelineId,
				key,
				label: input.label,
				color: input.color,
				outcome: input.outcome,
				position,
			},
		});
	}

	async updateStage(id: string, data: StageUpdateData): Promise<Stage> {
		if (data.color) this.guardColor(data.color);

		return this.db.$transaction(async (tx) => {
			const stage = await tx.stage.findUnique({ where: { id } });

			if (!stage) throw new NotFoundException("That stage does not exist.");

			const nextOutcome = data.outcome ?? stage.outcome;
			const nextIsEntry = data.isEntry ?? stage.isEntry;

			if (nextIsEntry && nextOutcome !== StageOutcome.OPEN) {
				throw new BadRequestException("The entry stage must be an open stage.");
			}

			if (stage.isEntry && !nextIsEntry) {
				throw new BadRequestException(
					"Every pipeline needs an entry stage. Make another stage the entry first.",
				);
			}

			if (data.outcome && data.outcome !== stage.outcome) {
				await this.guardOutcomeChange(tx, stage, data.outcome);
			}

			if (data.isEntry === true && !stage.isEntry) {
				await tx.stage.updateMany({
					where: {
						pipelineId: stage.pipelineId,
						isEntry: true,
						id: { not: id },
					},
					data: { isEntry: false },
				});
			}

			return tx.stage.update({
				where: { id },
				data: {
					label: data.label,
					color: data.color,
					outcome: data.outcome,
					isEntry: data.isEntry,
				},
			});
		}, BATCH_OPTIONS);
	}

	async reorderStages(input: StageReorderInput): Promise<Stage[]> {
		const owned = await this.db.stage.findMany({
			where: { id: { in: input.ids }, pipelineId: input.pipelineId },
			select: { id: true },
		});

		if (owned.length !== input.ids.length) {
			throw new BadRequestException(
				"That order names a stage which is not on this pipeline.",
			);
		}

		await this.db.$transaction(
			input.ids.map((id, index) =>
				this.db.stage.update({ where: { id }, data: { position: index } }),
			),
			BATCH_OPTIONS,
		);

		return this.db.stage.findMany({
			where: { pipelineId: input.pipelineId },
			orderBy: { position: "asc" },
		});
	}

	async archiveStage(id: string): Promise<Stage> {
		const stage = await this.db.stage.findUnique({ where: { id } });

		if (!stage) throw new NotFoundException("That stage does not exist.");

		if (stage.isEntry) {
			throw new BadRequestException(
				"Every pipeline needs an entry stage. Make another stage the entry before archiving this one.",
			);
		}

		await this.guardLastOfOutcome(this.db, stage, stage.outcome, "archive");

		return this.db.stage.update({
			where: { id },
			data: { archivedAt: new Date() },
		});
	}

	async restoreStage(id: string): Promise<Stage> {
		try {
			return await this.db.stage.update({
				where: { id },
				data: { archivedAt: null },
			});
		} catch (error) {
			throw this.translate(error, "stage");
		}
	}

	async deleteStage(id: string): Promise<{ id: string }> {
		const referenced = await this.db.deal.count({ where: { stageId: id } });

		if (referenced > 0) {
			throw new ConflictException(
				"This stage still holds deals — archive it instead.",
			);
		}

		try {
			await this.db.stage.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, "stage");
		}

		return { id };
	}

	async stageLabels(): Promise<Record<string, string>> {
		const stages = await this.db.stage.findMany({
			select: { key: true, label: true },
		});

		const labels: Record<string, string> = {};

		for (const stage of stages) {
			labels[stage.key] = stage.label;
		}

		return labels;
	}

	private async guardOutcomeChange(
		client: Db | Prisma.TransactionClient,
		stage: Stage,
		nextOutcome: StageOutcome,
	): Promise<void> {
		await this.guardLastOfOutcome(client, stage, stage.outcome, "retype", {
			replacedBy: nextOutcome,
		});
	}

	private async guardLastOfOutcome(
		client: Db | Prisma.TransactionClient,
		stage: Stage,
		outcome: StageOutcome,
		action: "archive" | "retype",
		options?: { replacedBy?: StageOutcome },
	): Promise<void> {
		if (options?.replacedBy === outcome) return;

		if (outcome === StageOutcome.WON) {
			const others = await client.stage.count({
				where: {
					pipelineId: stage.pipelineId,
					outcome: StageOutcome.WON,
					archivedAt: null,
					id: { not: stage.id },
				},
			});

			if (others === 0) {
				throw new BadRequestException(
					action === "archive"
						? "This pipeline needs at least one won stage. Add another before archiving this one."
						: "This pipeline needs at least one won stage. Add another before changing this one.",
				);
			}
		}

		if (outcome === StageOutcome.LOST) {
			const others = await client.stage.count({
				where: {
					pipelineId: stage.pipelineId,
					outcome: StageOutcome.LOST,
					archivedAt: null,
					id: { not: stage.id },
				},
			});

			if (others === 0) {
				throw new BadRequestException(
					action === "archive"
						? "This pipeline needs at least one lost stage. Add another before archiving this one."
						: "This pipeline needs at least one lost stage. Add another before changing this one.",
				);
			}
		}
	}

	private uniqueKeySync(label: string, taken: string[]): string {
		return uniqueKey(label, taken);
	}

	private guardColor(color: string): void {
		if (!(STAGE_SWATCHES as readonly string[]).includes(color)) {
			throw new BadRequestException(
				"Pick a color from the curated set of stage colors.",
			);
		}
	}

	private translate(error: unknown, kind: "pipeline" | "stage"): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(
				kind === "pipeline"
					? "That pipeline does not exist."
					: "That stage does not exist.",
			);
		}

		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2003"
		) {
			return new ConflictException(
				"This stage still holds deals — archive it instead.",
			);
		}

		return error;
	}
}

function uniqueKey(label: string, taken: string[]): string {
	const base = fieldKeyFromLabel(label);
	const used = new Set(taken);

	if (!used.has(base)) return base;

	let index = 2;
	while (used.has(`${base}_${index}`)) index += 1;

	return `${base}_${index}`;
}
