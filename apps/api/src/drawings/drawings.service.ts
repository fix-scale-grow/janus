import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	DRAWINGS,
	emptyScene,
	parseDrawingScale,
	parseDrawingScene,
} from "@crm/drawings";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import type {
	DrawingAttachInput,
	DrawingCreateInput,
	DrawingListInput,
	DrawingRenameInput,
	DrawingRestoreVersionInput,
	DrawingSaveSceneInput,
	DrawingSetThumbnailInput,
} from "./drawings.contracts";

const LIST_SELECT = {
	id: true,
	title: true,
	background: true,
	thumbnailUrl: true,
	dealId: true,
	contactId: true,
	updatedAt: true,
	deal: { select: { name: true } },
} as const;

@Injectable()
export class DrawingsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: DrawingListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.drawing.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.drawing.count({ where }),
		]);

		return {
			rows: rows.map(({ deal, ...row }) => ({
				...row,
				dealName: deal?.name ?? null,
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.db.drawing.findUnique({ where: { id } });

		if (!row) {
			throw new NotFoundException(`No drawing with id ${id}.`);
		}

		return {
			...row,
			scene: parseDrawingScene(row.scene),
			scale: parseDrawingScale(row.scale),
		};
	}

	async create(input: DrawingCreateInput, userId: string) {
		return this.db.drawing.create({
			data: {
				title: input.title ?? "Untitled drawing",
				background: input.background,
				scene: emptyScene() as Prisma.InputJsonValue,
				dealId: input.dealId,
				contactId: input.contactId,
				address: input.address,
				createdById: userId,
			},
			select: {
				id: true,
				title: true,
				background: true,
				dealId: true,
				contactId: true,
				address: true,
			},
		});
	}

	async saveScene(input: DrawingSaveSceneInput) {
		const latest = await this.db.drawingVersion.findFirst({
			where: { drawingId: input.id },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		const needsVersion =
			!latest ||
			Date.now() - latest.createdAt.getTime() >
				DRAWINGS.autosave.versionEveryMs;

		try {
			const [updated] = await this.db.$transaction([
				this.db.drawing.update({
					where: { id: input.id },
					data: {
						scene: input.scene as Prisma.InputJsonValue,
						scale: (input.scale ?? undefined) as
							| Prisma.InputJsonValue
							| undefined,
					},
					select: { updatedAt: true },
				}),
				...(needsVersion
					? [
							this.db.drawingVersion.create({
								data: {
									drawingId: input.id,
									scene: input.scene as Prisma.InputJsonValue,
									scale: (input.scale ?? undefined) as
										| Prisma.InputJsonValue
										| undefined,
								},
							}),
						]
					: []),
			]);

			return updated;
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async rename(input: DrawingRenameInput) {
		try {
			return await this.db.drawing.update({
				where: { id: input.id },
				data: { title: input.title },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async attach(input: DrawingAttachInput) {
		const data: Prisma.DrawingUpdateInput = {};

		if (input.dealId !== undefined) {
			data.deal =
				input.dealId === null
					? { disconnect: true }
					: { connect: { id: input.dealId } };
		}
		if (input.contactId !== undefined) {
			data.contact =
				input.contactId === null
					? { disconnect: true }
					: { connect: { id: input.contactId } };
		}

		try {
			return await this.db.drawing.update({
				where: { id: input.id },
				data,
				select: { id: true, dealId: true, contactId: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string) {
		try {
			return await this.db.drawing.delete({
				where: { id },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async versions(id: string) {
		return this.db.drawingVersion.findMany({
			where: { drawingId: id },
			orderBy: { createdAt: "desc" },
			select: { id: true, createdAt: true },
		});
	}

	async restoreVersion(input: DrawingRestoreVersionInput) {
		try {
			return await this.db.$transaction(async (tx) => {
				const version = await tx.drawingVersion.findUnique({
					where: { id: input.versionId },
					select: { drawingId: true, scene: true, scale: true },
				});

				if (!version || version.drawingId !== input.id) {
					throw new NotFoundException(
						`No version with id ${input.versionId} on this drawing.`,
					);
				}

				const updated = await tx.drawing.update({
					where: { id: input.id },
					data: {
						scene: version.scene as Prisma.InputJsonValue,
						scale: version.scale as Prisma.InputJsonValue,
					},
				});

				await tx.drawingVersion.create({
					data: {
						drawingId: input.id,
						scene: version.scene as Prisma.InputJsonValue,
						scale: version.scale as Prisma.InputJsonValue,
					},
				});

				return {
					...updated,
					scene: parseDrawingScene(updated.scene),
					scale: parseDrawingScale(updated.scale),
				};
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async setThumbnail(input: DrawingSetThumbnailInput) {
		try {
			return await this.db.drawing.update({
				where: { id: input.id },
				data: { thumbnailUrl: input.thumbnailUrl },
				select: { id: true, thumbnailUrl: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	private buildWhere(input: DrawingListInput): Prisma.DrawingWhereInput {
		const where: Prisma.DrawingWhereInput = {
			...(input.attachment === "deal" ? { dealId: { not: null } } : {}),
			...(input.attachment === "contact" ? { contactId: { not: null } } : {}),
			...(input.attachment === "unattached"
				? { dealId: null, contactId: null }
				: {}),
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
		};

		const term = input.q.trim();
		if (term) {
			where.title = { contains: term, mode: "insensitive" };
		}

		return where;
	}

	private translate(error: unknown, id: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No drawing with id ${id}.`);
		}
		return error;
	}
}
