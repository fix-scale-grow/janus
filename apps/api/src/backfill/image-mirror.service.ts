import type { Db } from "@crm/db";
import { blobEnabled, mirror } from "@crm/db/blob";
import { BLOB_HOST_SUFFIX } from "@crm/db/images";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

const MAX_PER_SWEEP = 25;

export type ImageMirrorResult = {
	scanned: number;
	copied: number;
};

@Injectable()
export class ImageMirrorService {
	private readonly logger = new Logger(ImageMirrorService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async sweep(): Promise<ImageMirrorResult> {
		if (!blobEnabled()) return { scanned: 0, copied: 0 };

		const results = [await this.sweepContacts(), await this.sweepUsers()];

		const total = results.reduce(
			(sum, result) => ({
				scanned: sum.scanned + result.scanned,
				copied: sum.copied + result.copied,
			}),
			{ scanned: 0, copied: 0 },
		);

		if (total.copied > 0) {
			this.logger.log({ message: "Mirrored external images", ...total });
		}

		return total;
	}

	private async sweepContacts(): Promise<ImageMirrorResult> {
		const rows = await this.db.contact.findMany({
			where: external("imageUrl"),
			orderBy: { createdAt: "asc" },
			take: MAX_PER_SWEEP,
			select: { id: true, imageUrl: true },
		});

		let copied = 0;

		for (const row of rows) {
			if (!row.imageUrl) continue;

			const stored = await mirror(row.imageUrl, `contacts/${row.id}`);
			if (!stored || stored === row.imageUrl) continue;

			const { count } = await this.db.contact.updateMany({
				where: { id: row.id, imageUrl: row.imageUrl },
				data: { imageUrl: stored },
			});

			copied += count;
		}

		return { scanned: rows.length, copied };
	}

	private async sweepUsers(): Promise<ImageMirrorResult> {
		const rows = await this.db.user.findMany({
			where: external("image"),
			take: MAX_PER_SWEEP,
			select: { id: true, image: true },
		});

		let copied = 0;

		for (const row of rows) {
			if (!row.image) continue;

			const stored = await mirror(row.image, `users/${row.id}/avatar`);
			if (!stored || stored === row.image) continue;

			const { count } = await this.db.user.updateMany({
				where: { id: row.id, image: row.image },
				data: { image: stored },
			});

			copied += count;
		}

		return { scanned: rows.length, copied };
	}
}

function external<T extends string>(
	field: T,
): Record<T, { not: null }> & { NOT: Record<T, { contains: string }> } {
	return {
		...({ [field]: { not: null } } as Record<T, { not: null }>),
		NOT: { [field]: { contains: BLOB_HOST_SUFFIX } } as Record<
			T,
			{ contains: string }
		>,
	};
}
