import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ReportsRouter } from "./reports.router";
import { ReportsService } from "./reports.service";

@Module({
	imports: [PermissionsModule],
	providers: [ReportsService, ReportsRouter],
	exports: [ReportsService],
})
export class ReportsModule {}
