import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { ContractsRouter } from "./contracts.router";
import { ContractsService } from "./contracts.service";

@Module({
	imports: [MailerModule, TemplatesModule],
	providers: [ContractsService, ContractsRouter],
	exports: [ContractsService],
})
export class ContractsModule {}
