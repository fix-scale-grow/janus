import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { MergeContextService } from "./merge-context.service";
import { TemplatesRouter } from "./templates.router";
import { TemplatesService } from "./templates.service";

@Module({
	imports: [MailerModule],
	providers: [TemplatesService, MergeContextService, TemplatesRouter],
	exports: [TemplatesService, MergeContextService],
})
export class TemplatesModule {}
