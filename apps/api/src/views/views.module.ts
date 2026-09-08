import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { ViewsRouter } from "./views.router";
import { ViewsService } from "./views.service";

@Module({
	imports: [TrpcModule],
	providers: [ViewsService, ViewsRouter],
	exports: [ViewsService],
})
export class ViewsModule {}
