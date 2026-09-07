import { Module } from "@nestjs/common";
import { CrewsRouter } from "./crews.router";
import { CrewsService } from "./crews.service";

@Module({
	providers: [CrewsService, CrewsRouter],
	exports: [CrewsService],
})
export class CrewsModule {}
