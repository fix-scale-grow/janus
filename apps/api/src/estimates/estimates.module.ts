import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { EstimatesRouter } from "./estimates.router";
import { EstimatesService } from "./estimates.service";

@Module({
	imports: [ContactsModule, MailerModule, TemplatesModule],
	providers: [EstimatesService, EstimatesRouter],
	exports: [EstimatesService],
})
export class EstimatesModule {}
