import { Module } from "@nestjs/common";
import { PermissionsRouter } from "./permissions.router";
import { PermissionsService } from "./permissions.service";

@Module({
	providers: [PermissionsService, PermissionsRouter],
	exports: [PermissionsService],
})
export class PermissionsModule {}
