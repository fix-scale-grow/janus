import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { MailerModule } from "../mailer/mailer.module";
import { EstimatesRouter } from "./estimates.router";
import { EstimatesService } from "./estimates.service";

@Module({
	imports: [ContactsModule, MailerModule],
	providers: [EstimatesService, EstimatesRouter],
	exports: [EstimatesService],
})
export class EstimatesModule {}
