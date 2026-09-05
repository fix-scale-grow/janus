import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	imports: [MailerModule],
	providers: [InvoicesService, InvoicesRouter],
	exports: [InvoicesService],
})
export class InvoicesModule {}
