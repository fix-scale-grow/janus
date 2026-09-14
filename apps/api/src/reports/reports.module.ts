import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { ReportsRouter } from "./reports.router";
import { ReportsService } from "./reports.service";

@Module({
	imports: [PermissionsModule, CurrencyModule],
	providers: [ReportsService, ReportsRouter],
	exports: [ReportsService],
})
export class ReportsModule {}
