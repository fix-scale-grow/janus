import { Module } from "@nestjs/common";
import { PermitsRouter } from "./permits.router";
import { PermitsService } from "./permits.service";
import { PlaybooksService } from "./playbooks.service";

@Module({
	providers: [PermitsService, PlaybooksService, PermitsRouter],
	exports: [PermitsService],
})
export class PermitsModule {}
