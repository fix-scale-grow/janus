import { type Db, type Prisma } from "@crm/db";
import { readPhotoFile } from "@crm/db/photo-files";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type {
	EstimateLinkInput,
	EstimatePdfFlagInput,
	EstimateReorderInput,
	InvoiceLinkInput,
	InvoicePdfFlagInput,
	InvoiceReorderInput,
	PhotoListInput,
	ProjectLinkInput,
	ProjectStageInput,
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

export type PdfPhoto = { filename: string; dataUrl: string };

@Injectable()
export class PhotosService {
	private readonly logger = new Logger(PhotosService.name);

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

	async forInvoice(invoiceId: string) {
		return this.db.invoicePhoto.findMany({
			where: { invoiceId },
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

	async linkInvoice(input: InvoiceLinkInput): Promise<{ id: string }> {
		const [invoice, photo] = await Promise.all([
			this.db.invoice.findUnique({
				where: { id: input.invoiceId },
				select: { id: true },
			}),
			this.db.photo.findUnique({
				where: { id: input.photoId },
				select: { id: true },
			}),
		]);

		if (!invoice) throw new NotFoundException("The invoice was not found.");
		if (!photo) throw new NotFoundException("The photo was not found.");

		const last = await this.db.invoicePhoto.findFirst({
			where: { invoiceId: input.invoiceId },
			orderBy: { sortOrder: "desc" },
			select: { sortOrder: true },
		});

		return this.db.invoicePhoto.upsert({
			where: {
				invoiceId_photoId: {
					invoiceId: input.invoiceId,
					photoId: input.photoId,
				},
			},
			create: {
				invoiceId: input.invoiceId,
				photoId: input.photoId,
				sortOrder: last ? last.sortOrder + 1 : 0,
			},
			update: {},
			select: { id: true },
		});
	}

	async unlinkInvoice(input: InvoiceLinkInput): Promise<void> {
		await this.db.invoicePhoto.deleteMany({
			where: { invoiceId: input.invoiceId, photoId: input.photoId },
		});
	}

	async setInvoicePdfFlag(input: InvoicePdfFlagInput): Promise<void> {
		await this.db.invoicePhoto.updateMany({
			where: { invoiceId: input.invoiceId, photoId: input.photoId },
			data: { includeInPdf: input.includeInPdf },
		});
	}

	async reorderInvoicePhotos(input: InvoiceReorderInput): Promise<void> {
		const linked = await this.db.invoicePhoto.findMany({
			where: { invoiceId: input.invoiceId },
			select: { photoId: true },
		});

		if (!sameIdSet(linked, input.photoIds)) {
			throw new BadRequestException(
				"The photo list does not match the invoice's photos.",
			);
		}

		await this.db.$transaction(
			input.photoIds.map((photoId, index) =>
				this.db.invoicePhoto.update({
					where: {
						invoiceId_photoId: { invoiceId: input.invoiceId, photoId },
					},
					data: { sortOrder: index },
				}),
			),
		);
	}

	async forProject(projectId: string) {
		return this.db.projectPhoto.findMany({
			where: { projectId },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				photoId: true,
				stageLabel: true,
				sortOrder: true,
				photo: { select: PHOTO_SELECT },
			},
		});
	}

	async linkProject(input: ProjectLinkInput): Promise<{ id: string }> {
		const [project, photo] = await Promise.all([
			this.db.project.findUnique({
				where: { id: input.projectId },
				select: { id: true },
			}),
			this.db.photo.findUnique({
				where: { id: input.photoId },
				select: { id: true },
			}),
		]);

		if (!project) throw new NotFoundException("The project was not found.");
		if (!photo) throw new NotFoundException("The photo was not found.");

		const last = await this.db.projectPhoto.findFirst({
			where: { projectId: input.projectId },
			orderBy: { sortOrder: "desc" },
			select: { sortOrder: true },
		});

		return this.db.projectPhoto.upsert({
			where: {
				projectId_photoId: {
					projectId: input.projectId,
					photoId: input.photoId,
				},
			},
			create: {
				projectId: input.projectId,
				photoId: input.photoId,
				sortOrder: last ? last.sortOrder + 1 : 0,
			},
			update: {},
			select: { id: true },
		});
	}

	async unlinkProject(input: ProjectLinkInput): Promise<void> {
		await this.db.projectPhoto.deleteMany({
			where: { projectId: input.projectId, photoId: input.photoId },
		});
	}

	async setProjectStage(input: ProjectStageInput): Promise<void> {
		await this.db.projectPhoto.updateMany({
			where: { projectId: input.projectId, photoId: input.photoId },
			data: { stageLabel: input.stageLabel },
		});
	}

	async pdfPhotosForEstimate(estimateId: string): Promise<PdfPhoto[]> {
		const links = await this.db.estimatePhoto.findMany({
			where: { estimateId, includeInPdf: true },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: { photoId: true, photo: { select: { filename: true } } },
		});

		return this.readPdfPhotos(links);
	}

	async pdfPhotosForInvoice(invoiceId: string): Promise<PdfPhoto[]> {
		const links = await this.db.invoicePhoto.findMany({
			where: { invoiceId, includeInPdf: true },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: { photoId: true, photo: { select: { filename: true } } },
		});

		return this.readPdfPhotos(links);
	}

	private async readPdfPhotos(
		links: { photoId: string; photo: { filename: string } }[],
	): Promise<PdfPhoto[]> {
		const photos: PdfPhoto[] = [];

		for (const link of links) {
			const master = await readPhotoFile(link.photoId, "master");
			if (!master) {
				this.logger.warn({
					message: "Skipping pdf photo with a missing master file",
					photoId: link.photoId,
				});
				continue;
			}
			photos.push({
				filename: link.photo.filename,
				dataUrl: `data:image/jpeg;base64,${master.toString("base64")}`,
			});
		}

		return photos;
	}
}
