import { Module } from "@nestjs/common";
import { ContractsModule } from "../contracts/contracts.module";
import { MailerModule } from "../mailer/mailer.module";
import { PhotosModule } from "../photos/photos.module";
import { TemplatesModule } from "../templates/templates.module";
import { ProposalViewRouter } from "./proposal-view.router";
import { ProposalsRouter } from "./proposals.router";
import { ProposalsService } from "./proposals.service";

@Module({
	imports: [ContractsModule, MailerModule, PhotosModule, TemplatesModule],
	providers: [ProposalsService, ProposalsRouter, ProposalViewRouter],
	exports: [ProposalsService],
})
export class ProposalsModule {}
