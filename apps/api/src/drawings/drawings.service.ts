import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import type { AccessPrincipal } from "@crm/db/access-policy";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
	isUnscoped,
} from "@crm/db/access-scope";
import {
	DRAWINGS,
	emptyScene,
	isSceneTooLarge,
	parseDrawingScale,
	parseDrawingScene,
} from "@crm/drawings";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	PayloadTooLargeException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import type {
	DrawingAttachInput,
	DrawingCreateInput,
	DrawingListInput,
	DrawingMoveInput,
	DrawingRenameInput,
	DrawingRestoreVersionInput,
	DrawingSaveSceneInput,
	DrawingSetThumbnailInput,
	FolderCreateInput,
	FolderRenameInput,
} from "./drawings.contracts";

const LIST_SELECT = {
	id: true,
	title: true,
	background: true,
	thumbnailUrl: true,
	folderId: true,
	dealId: true,
	contactId: true,
	updatedAt: true,
	deal: { select: { name: true } },
} as const;

@Injectable()
export class DrawingsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: DrawingListInput, p: AccessPrincipal) {
		const where: Prisma.DrawingWhereInput = {
			AND: [this.buildWhere(input), dealChildWhere(p)],
		};
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

	async byId(id: string, p: AccessPrincipal) {
		const row = await this.db.drawing.findFirst({
			where: { AND: [{ id }, dealChildWhere(p)] },
		});

		if (!row) {
			throw new NotFoundException(`No drawing with id ${id}.`);
		}

		return {
			...row,
			scene: parseDrawingScene(row.scene),
			scale: parseDrawingScale(row.scale),
		};
	}

	async create(input: DrawingCreateInput, userId: string, p: AccessPrincipal) {
		if (input.dealId) {
			await this.assertDealInScope(input.dealId, p);
		} else {
			this.assertDeallessCreateAllowed(p);
		}
		if (input.contactId) {
			await this.assertContactInScope(input.contactId, p);
		}
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

	async saveScene(input: DrawingSaveSceneInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
		if (isSceneTooLarge(input.scene)) {
			throw new PayloadTooLargeException(
				`Scene exceeds the ${DRAWINGS.limits.maxSceneBytes} byte limit.`,
			);
		}

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
			return await this.db.$transaction(async (tx) => {
				if (input.expectedSceneUpdatedAt !== undefined) {
					const stored = await tx.drawing.findUnique({
						where: { id: input.id },
						select: { sceneUpdatedAt: true },
					});
					if (!stored) {
						throw new NotFoundException(`No drawing with id ${input.id}.`);
					}
					const expected = input.expectedSceneUpdatedAt?.getTime() ?? null;
					const actual = stored.sceneUpdatedAt?.getTime() ?? null;
					if (expected !== actual) {
						throw new ConflictException(
							"This drawing changed in another window. Reload to keep editing.",
						);
					}
				}

				const updated = await tx.drawing.update({
					where: { id: input.id },
					data: {
						scene: input.scene as Prisma.InputJsonValue,
						sceneUpdatedAt: new Date(),
						scale: (input.scale ?? undefined) as
							| Prisma.InputJsonValue
							| undefined,
					},
					select: { updatedAt: true, sceneUpdatedAt: true },
				});

				if (needsVersion) {
					await tx.drawingVersion.create({
						data: {
							drawingId: input.id,
							scene: input.scene as Prisma.InputJsonValue,
							scale: (input.scale ?? undefined) as
								| Prisma.InputJsonValue
								| undefined,
						},
					});

					await this.pruneVersions(tx, input.id);
				}

				return updated;
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async rename(input: DrawingRenameInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
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

	async attach(input: DrawingAttachInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
		const data: Prisma.DrawingUpdateInput = {};

		if (input.dealId !== undefined) {
			if (input.dealId !== null) {
				await this.assertDealInScope(input.dealId, p);
			}
			data.deal =
				input.dealId === null
					? { disconnect: true }
					: { connect: { id: input.dealId } };
		}
		if (input.contactId !== undefined) {
			if (input.contactId !== null) {
				await this.assertContactInScope(input.contactId, p);
			}
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

	async delete(id: string, p: AccessPrincipal) {
		await this.assertInScope(id, p);
		try {
			return await this.db.drawing.delete({
				where: { id },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async folders(p: AccessPrincipal) {
		const rows = await this.db.drawingFolder.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				_count: { select: { drawings: { where: dealChildWhere(p) } } },
			},
		});
		return rows.map(({ _count, ...row }) => ({
			...row,
			drawingCount: _count.drawings,
		}));
	}

	async createFolder(input: FolderCreateInput) {
		try {
			return await this.db.drawingFolder.create({
				data: { name: input.name },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translateFolder(error, null);
		}
	}

	async renameFolder(input: FolderRenameInput) {
		try {
			return await this.db.drawingFolder.update({
				where: { id: input.id },
				data: { name: input.name },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translateFolder(error, input.id);
		}
	}

	async deleteFolder(id: string) {
		try {
			return await this.db.drawingFolder.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translateFolder(error, id);
		}
	}

	async move(input: DrawingMoveInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
		try {
			return await this.db.drawing.update({
				where: { id: input.id },
				data: {
					folder:
						input.folderId === null
							? { disconnect: true }
							: { connect: { id: input.folderId } },
				},
				select: { id: true, folderId: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async versions(id: string, p: AccessPrincipal) {
		await this.assertInScope(id, p);
		return this.db.drawingVersion.findMany({
			where: { drawingId: id },
			orderBy: { createdAt: "desc" },
			select: { id: true, createdAt: true },
		});
	}

	async restoreVersion(input: DrawingRestoreVersionInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
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
						sceneUpdatedAt: new Date(),
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

				await this.pruneVersions(tx, input.id);

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

	async setThumbnail(input: DrawingSetThumbnailInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
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

	private async pruneVersions(
		tx: Prisma.TransactionClient,
		drawingId: string,
	): Promise<void> {
		const stale = await tx.drawingVersion.findMany({
			where: { drawingId },
			orderBy: { createdAt: "desc" },
			skip: DRAWINGS.limits.maxVersions,
			select: { id: true },
		});

		if (stale.length === 0) return;

		await tx.drawingVersion.deleteMany({
			where: { id: { in: stale.map((version) => version.id) } },
		});
	}

	private buildWhere(input: DrawingListInput): Prisma.DrawingWhereInput {
		const where: Prisma.DrawingWhereInput = {
			...(input.attachment === "deal" ? { dealId: { not: null } } : {}),
			...(input.attachment === "contact" ? { contactId: { not: null } } : {}),
			...(input.attachment === "unattached"
				? { dealId: null, contactId: null }
				: {}),
			...(input.folderId ? { folderId: input.folderId } : {}),
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId
				? {
						OR: [
							{ contactId: input.contactId },
							{ deal: { contacts: { some: { contactId: input.contactId } } } },
						],
					}
				: {}),
		};

		const term = input.q.trim();
		if (term) {
			where.title = { contains: term, mode: "insensitive" };
		}

		return where;
	}

	private async assertInScope(id: string, p: AccessPrincipal): Promise<void> {
		const found = await this.db.drawing.findFirst({
			where: { AND: [{ id }, dealChildWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No drawing with id ${id}.`);
	}

	private async assertDealInScope(
		dealId: string,
		p: AccessPrincipal,
	): Promise<void> {
		const found = await this.db.deal.findFirst({
			where: { AND: [{ id: dealId }, dealScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No deal with id ${dealId}.`);
	}

	private async assertContactInScope(
		contactId: string,
		p: AccessPrincipal,
	): Promise<void> {
		const found = await this.db.contact.findFirst({
			where: { AND: [{ id: contactId }, contactScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) {
			throw new NotFoundException(`No contact with id ${contactId}.`);
		}
	}

	private assertDeallessCreateAllowed(p: AccessPrincipal): void {
		if (isUnscoped(p) || p.scope !== "ASSIGNED") return;
		throw new ForbiddenException(
			`Your group (${p.groupName}) can only create these on a job assigned to you. Ask an admin.`,
		);
	}

	private translateFolder(error: unknown, id: string | null): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return new ConflictException("A folder with that name already exists.");
		}
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No folder with id ${id}.`);
		}
		return error;
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
