import { Module } from "@nestjs/common";
import { ServicesCatalogRouter } from "./services-catalog.router";
import { ServicesCatalogService } from "./services-catalog.service";

@Module({
	providers: [ServicesCatalogService, ServicesCatalogRouter],
	exports: [ServicesCatalogService],
})
export class ServicesCatalogModule {}
