import { Module } from "@nestjs/common";
import { ProductionModule } from "../production/production.module";
import { ProjectsRouter } from "./projects.router";
import { ProjectsService } from "./projects.service";

@Module({
	imports: [ProductionModule],
	providers: [ProjectsService, ProjectsRouter],
	exports: [ProjectsService],
})
export class ProjectsModule {}
