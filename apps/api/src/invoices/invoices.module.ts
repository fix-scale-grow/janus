import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	imports: [MailerModule, TemplatesModule],
	providers: [InvoicesService, InvoicesRouter],
	exports: [InvoicesService],
})
export class InvoicesModule {}
