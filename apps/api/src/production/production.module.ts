import { Module } from "@nestjs/common";
import { ProductionAdvanceService } from "./production-advance.service";

@Module({
	providers: [ProductionAdvanceService],
	exports: [ProductionAdvanceService],
})
export class ProductionModule {}
