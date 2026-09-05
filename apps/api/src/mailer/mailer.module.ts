import { Module } from "@nestjs/common";
import { resolveMailerConfig } from "./mailer.config";
import { MAILER_CONFIG } from "./mailer.constants";
import { MailerService } from "./mailer.service";

@Module({
	providers: [
		{ provide: MAILER_CONFIG, useFactory: () => resolveMailerConfig() },
		MailerService,
	],
	exports: [MailerService],
})
export class MailerModule {}
