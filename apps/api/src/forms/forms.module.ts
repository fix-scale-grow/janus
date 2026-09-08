import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { DealsModule } from "../deals/deals.module";
import { FieldsModule } from "../fields/fields.module";
import { MailerModule } from "../mailer/mailer.module";
import { TemplatesModule } from "../templates/templates.module";
import { TrackingModule } from "../tracking/tracking.module";
import { TrpcModule } from "../trpc/trpc.module";
import { FormsRouter } from "./forms.router";
import { FormsService } from "./forms.service";
import { FormsPublicController } from "./forms-public.controller";

@Module({
	imports: [
		TrpcModule,
		TrackingModule,
		FieldsModule,
		DealsModule,
		TemplatesModule,
		MailerModule,
		CrmModule,
	],
	controllers: [FormsPublicController],
	providers: [FormsService, FormsRouter],
})
export class FormsModule {}
