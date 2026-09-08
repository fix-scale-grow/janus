import type { Db } from "@crm/db";
import {
	parseViewState,
	VIEW_STATE_MAX_BYTES,
	type ViewState,
	type ViewTableId,
} from "@crm/db/user-views";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class ViewsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async get(userId: string, tableId: ViewTableId): Promise<ViewState | null> {
		const row = await this.db.userView.findUnique({
			where: { userId_tableId: { userId, tableId } },
			select: { state: true },
		});

		if (!row) return null;

		return parseViewState(row.state);
	}

	async save(
		userId: string,
		tableId: ViewTableId,
		state: ViewState,
	): Promise<ViewState> {
		const parsed = parseViewState(state);
		const bytes = Buffer.byteLength(JSON.stringify(parsed), "utf8");

		if (bytes > VIEW_STATE_MAX_BYTES) {
			throw new BadRequestException("That view is too large to save.");
		}

		await this.db.userView.upsert({
			where: { userId_tableId: { userId, tableId } },
			create: { userId, tableId, state: parsed },
			update: { state: parsed },
		});

		return parsed;
	}

	async reset(userId: string, tableId: ViewTableId): Promise<void> {
		await this.db.userView.deleteMany({ where: { userId, tableId } });
	}
}
