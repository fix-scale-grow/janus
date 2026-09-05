import { Module } from "@nestjs/common";
import { EstimatesRouter } from "./estimates.router";
import { EstimatesService } from "./estimates.service";

@Module({
	providers: [EstimatesService, EstimatesRouter],
	exports: [EstimatesService],
})
export class EstimatesModule {}
