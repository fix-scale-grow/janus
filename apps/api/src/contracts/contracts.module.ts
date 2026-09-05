import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { ContractSigningRouter } from "./contract-signing.router";
import { ContractsRouter } from "./contracts.router";
import { ContractsService } from "./contracts.service";

@Module({
	imports: [MailerModule, TemplatesModule],
	providers: [ContractsService, ContractsRouter, ContractSigningRouter],
	exports: [ContractsService],
})
export class ContractsModule {}
