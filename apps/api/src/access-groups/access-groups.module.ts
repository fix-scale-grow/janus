import { Module } from "@nestjs/common";
import { AccessGroupsRouter } from "./access-groups.router";
import { AccessGroupsService } from "./access-groups.service";

@Module({
	providers: [AccessGroupsService, AccessGroupsRouter],
	exports: [AccessGroupsService],
})
export class AccessGroupsModule {}
