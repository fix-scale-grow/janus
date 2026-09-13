import { Module } from "@nestjs/common";
import { PermitPrefillService } from "./permit-prefill.service";
import { PermitsRouter } from "./permits.router";
import { PermitsService } from "./permits.service";
import { PlaybooksService } from "./playbooks.service";

@Module({
	providers: [
		PermitsService,
		PlaybooksService,
		PermitPrefillService,
		PermitsRouter,
	],
	exports: [PermitsService],
})
export class PermitsModule {}
