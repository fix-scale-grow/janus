import { Module } from "@nestjs/common";
import { CostsRouter } from "./costs.router";
import { CostsService } from "./costs.service";

@Module({
	providers: [CostsService, CostsRouter],
	exports: [CostsService],
})
export class CostsModule {}
