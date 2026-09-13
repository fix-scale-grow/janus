import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { PhotosModule } from "../photos/photos.module";
import { ProductionModule } from "../production/production.module";
import { TemplatesModule } from "../templates/templates.module";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	imports: [MailerModule, PhotosModule, ProductionModule, TemplatesModule],
	providers: [InvoicesService, InvoicesRouter],
	exports: [InvoicesService],
})
export class InvoicesModule {}
