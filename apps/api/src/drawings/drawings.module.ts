import { Module } from "@nestjs/common";
import { DrawingsRouter } from "./drawings.router";
import { DrawingsService } from "./drawings.service";

@Module({
	providers: [DrawingsService, DrawingsRouter],
	exports: [DrawingsService],
})
export class DrawingsModule {}
