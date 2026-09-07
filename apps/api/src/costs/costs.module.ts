import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { CostsRouter } from "./costs.router";
import { CostsService } from "./costs.service";

@Module({
	imports: [PermissionsModule],
	providers: [CostsService, CostsRouter],
	exports: [CostsService],
})
export class CostsModule {}
