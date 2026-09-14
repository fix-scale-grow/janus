import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { PermitPrefillService } from "./permit-prefill.service";
import { PermitTriggerService } from "./permit-trigger.service";
import { PermitsRouter } from "./permits.router";
import { PermitsService } from "./permits.service";
import { PlaybooksService } from "./playbooks.service";

@Module({
	imports: [AgentModule],
	providers: [
		PermitsService,
		PlaybooksService,
		PermitPrefillService,
		PermitTriggerService,
		PermitsRouter,
	],
	exports: [PermitsService, PermitTriggerService],
})
export class PermitsModule {}
