import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { MailboxApiClient } from "./mailbox-api.client";
import { MailboxMatchService } from "./mailbox-match.service";
import { MailboxTokenService } from "./mailbox-token.service";
import { SyncStateService } from "./sync-state.service";
import { ThreadWriterService } from "./thread-writer.service";

@Module({
	imports: [AgentModule],
	providers: [
		MailboxApiClient,
		MailboxTokenService,
		MailboxMatchService,
		SyncStateService,
		ThreadWriterService,
	],
	exports: [
		MailboxApiClient,
		MailboxTokenService,
		MailboxMatchService,
		SyncStateService,
		ThreadWriterService,
	],
})
export class MailboxModule {}
