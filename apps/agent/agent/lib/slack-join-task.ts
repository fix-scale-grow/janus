import { parse, schemas } from "@crm/validation";
import { joinSlackChannel } from "./slack-membership";

export async function runSlackChannelJoin(value: unknown): Promise<string> {
	const { channelId, channelName } = parse(
		schemas.slack.joinPayload,
		value,
		"A slack-channel-join task carries an unreadable payload",
	);
	const outcome = await joinSlackChannel(channelId);

	if (outcome.joined) {
		return outcome.already
			? `Janus was already in #${channelName}.`
			: `Janus joined #${channelName}.`;
	}

	return `Janus could not join #${channelName}. ${outcome.reason}`;
}
