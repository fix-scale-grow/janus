import { createAnthropic } from "@ai-sdk/anthropic";
import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL, readAgentModel } from "@crm/db/settings";
import type { LanguageModel } from "ai";
import { resolveProvider } from "./anthropic-provider";
import { noteModel } from "./model-usage";

export interface ModelSelection {
	model: string | LanguageModel;
	modelContextWindowTokens: number;
}

export const DIRECT_ANTHROPIC = {
	defaultModelId: "claude-sonnet-5",
	defaultContextWindowTokens: 200_000,
	oauthBetaHeader: "oauth-2025-04-20",
} as const;

function directAnthropicProvider(): ReturnType<typeof createAnthropic> | null {
	const provider = resolveProvider(process.env);

	if (provider === null) return null;

	return provider.kind === "api-key"
		? createAnthropic({ apiKey: provider.apiKey })
		: createAnthropic({
				authToken: provider.token,
				headers: { "anthropic-beta": DIRECT_ANTHROPIC.oauthBetaHeader },
			});
}

export async function selectedModel(): Promise<ModelSelection | null> {
	try {
		const setting = await readAgentModel(db);
		const provider = directAnthropicProvider();

		if (provider === null) {
			if (setting.isDefault) return null;

			return {
				model: setting.id,
				modelContextWindowTokens: setting.contextWindowTokens,
			};
		}

		const id = setting.isDefault ? DIRECT_ANTHROPIC.defaultModelId : setting.id;
		const modelContextWindowTokens = setting.isDefault
			? DIRECT_ANTHROPIC.defaultContextWindowTokens
			: setting.contextWindowTokens;

		return {
			model: provider(id),
			modelContextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}

export function selectedModelId(
	selection: ModelSelection | null,
	fallbackId: string,
): string {
	if (selection === null) return fallbackId;
	return typeof selection.model === "string"
		? selection.model
		: selection.model.modelId;
}

async function resolveAndTrack(
	sessionId: string,
): Promise<ModelSelection | null> {
	const selection = await selectedModel();
	noteModel(sessionId, selectedModelId(selection, DEFAULT_AGENT_MODEL.id));
	return selection;
}

type DynamicModelHandler = (
	_event: unknown,
	ctx: { session: { id: string } },
) => Promise<ModelSelection | null>;

type DynamicModelEvents = Partial<
	Record<"session.started" | "step.started", DynamicModelHandler>
>;

export function dynamicAgentModelEvents(): DynamicModelEvents {
	const handler: DynamicModelHandler = (_event, ctx) =>
		resolveAndTrack(ctx.session.id);

	return resolveProvider(process.env) === null
		? { "session.started": handler }
		: { "step.started": handler };
}
