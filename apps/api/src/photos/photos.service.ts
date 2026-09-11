import { type Db, type Prisma } from "@crm/db";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type {
	EstimateLinkInput,
	EstimatePdfFlagInput,
	EstimateReorderInput,
	PhotoListInput,
} from "./photos.contracts";

const PHOTO_LIST_TAKE = 500;

const PHOTO_SELECT = {
	id: true,
	dealId: true,
	contactId: true,
	filename: true,
	width: true,
	height: true,
	sizeBytes: true,
	takenAt: true,
	createdAt: true,
	uploadedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.PhotoSelect;

function sameIdSet(linked: { photoId: string }[], ids: string[]): boolean {
	const linkedIds = new Set(linked.map((row) => row.photoId));
	const inputIds = new Set(ids);

	return (
		inputIds.size === ids.length &&
		inputIds.size === linkedIds.size &&
		ids.every((id) => linkedIds.has(id))
	);
}

@Injectable()
export class PhotosService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: PhotoListInput) {
		const where: Prisma.PhotoWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
		};

		const [rows, total] = await Promise.all([
			this.db.photo.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: PHOTO_LIST_TAKE,
				select: PHOTO_SELECT,
			}),
			this.db.photo.count({ where }),
		]);

		return { rows, total };
	}

	async forEstimate(estimateId: string) {
		return this.db.estimatePhoto.findMany({
			where: { estimateId },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				photoId: true,
				includeInPdf: true,
				sortOrder: true,
				photo: { select: PHOTO_SELECT },
			},
		});
	}

	async linkEstimate(input: EstimateLinkInput): Promise<{ id: string }> {
		const [estimate, photo] = await Promise.all([
			this.db.estimate.findUnique({
				where: { id: input.estimateId },
				select: { id: true },
			}),
			this.db.photo.findUnique({
				where: { id: input.photoId },
				select: { id: true },
			}),
		]);

		if (!estimate) throw new NotFoundException("The estimate was not found.");
		if (!photo) throw new NotFoundException("The photo was not found.");

		const last = await this.db.estimatePhoto.findFirst({
			where: { estimateId: input.estimateId },
			orderBy: { sortOrder: "desc" },
			select: { sortOrder: true },
		});

		return this.db.estimatePhoto.upsert({
			where: {
				estimateId_photoId: {
					estimateId: input.estimateId,
					photoId: input.photoId,
				},
			},
			create: {
				estimateId: input.estimateId,
				photoId: input.photoId,
				sortOrder: last ? last.sortOrder + 1 : 0,
			},
			update: {},
			select: { id: true },
		});
	}

	async unlinkEstimate(input: EstimateLinkInput): Promise<void> {
		await this.db.estimatePhoto.deleteMany({
			where: { estimateId: input.estimateId, photoId: input.photoId },
		});
	}

	async setEstimatePdfFlag(input: EstimatePdfFlagInput): Promise<void> {
		await this.db.estimatePhoto.updateMany({
			where: { estimateId: input.estimateId, photoId: input.photoId },
			data: { includeInPdf: input.includeInPdf },
		});
	}

	async reorderEstimatePhotos(input: EstimateReorderInput): Promise<void> {
		const linked = await this.db.estimatePhoto.findMany({
			where: { estimateId: input.estimateId },
			select: { photoId: true },
		});

		if (!sameIdSet(linked, input.photoIds)) {
			throw new BadRequestException(
				"The photo list does not match the estimate's photos.",
			);
		}

		await this.db.$transaction(
			input.photoIds.map((photoId, index) =>
				this.db.estimatePhoto.update({
					where: {
						estimateId_photoId: { estimateId: input.estimateId, photoId },
					},
					data: { sortOrder: index },
				}),
			),
		);
	}
}
