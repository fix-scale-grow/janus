import { Module } from "@nestjs/common";
import { RecentsRouter } from "./recents.router";
import { RecentsService } from "./recents.service";

@Module({
	providers: [RecentsService, RecentsRouter],
	exports: [RecentsService],
})
export class RecentsModule {}
