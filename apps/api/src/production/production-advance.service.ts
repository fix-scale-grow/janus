import type { Db } from "@crm/db";
import { ActivityType, InvoiceStatus, ProductionStage } from "@crm/db/enums";
import {
	type AutoProductionStage,
	canAutoAdvance,
} from "@crm/db/production-semantics";
import { isWonStage } from "@crm/db/stage-semantics";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class ProductionAdvanceService {
	private readonly logger = new Logger(ProductionAdvanceService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async advance(
		dealId: string,
		target: AutoProductionStage,
		actingUserId: string,
	): Promise<void> {
		try {
			const deal = await this.db.deal.findUnique({
				where: { id: dealId },
				select: {
					id: true,
					productionStage: true,
					stage: { select: { outcome: true } },
				},
			});
			if (!deal || !isWonStage(deal.stage)) return;
			if (!canAutoAdvance(deal.productionStage, target)) return;

			const now = new Date();
			await this.db.deal.update({
				where: { id: dealId },
				data: { productionStage: target, productionStageChangedAt: now },
				select: { id: true },
			});
			await this.db.activity.create({
				data: {
					type: ActivityType.STAGE_CHANGE,
					subject: "Production stage changed",
					occurredAt: now,
					dealId: deal.id,
					createdById: actingUserId,
					meta: {
						kind: "production",
						from: deal.productionStage,
						to: target,
						auto: true,
					},
				},
			});
		} catch (error) {
			this.logger.error(
				{ message: "Production auto-advance failed", dealId, target },
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async advanceWhenPaid(dealId: string, actingUserId: string): Promise<void> {
		let settled = false;
		try {
			const invoices = await this.db.invoice.findMany({
				where: { dealId, status: { not: InvoiceStatus.VOID } },
				select: { status: true },
			});
			settled =
				invoices.length > 0 &&
				invoices.every((invoice) => invoice.status === InvoiceStatus.PAID);
		} catch (error) {
			this.logger.error(
				{ message: "Production paid check failed", dealId },
				error instanceof Error ? error.stack : undefined,
			);
			return;
		}
		if (!settled) return;
		await this.advance(dealId, ProductionStage.PAID, actingUserId);
	}
}
