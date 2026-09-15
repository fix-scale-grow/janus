import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { ReportsRouter } from "./reports.router";
import { ReportsService } from "./reports.service";

@Module({
	imports: [CurrencyModule],
	providers: [ReportsService, ReportsRouter],
	exports: [ReportsService],
})
export class ReportsModule {}
