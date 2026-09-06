import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { ContactsModule } from "../contacts/contacts.module";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { EstimatesRouter } from "./estimates.router";
import { EstimatesService } from "./estimates.service";

@Module({
	imports: [AgentModule, ContactsModule, MailerModule, TemplatesModule],
	providers: [EstimatesService, EstimatesRouter],
	exports: [EstimatesService],
})
export class EstimatesModule {}
