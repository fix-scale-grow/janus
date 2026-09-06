export interface UsageRowInput {
	sessionId: string;
	conversationId: string | null;
	taskKind: string | null;
	model: string;
}

export interface UsageRow extends UsageRowInput {
	inputTokens: number;
	outputTokens: number;
}

export function usageRowFrom(
	data: unknown,
	input: UsageRowInput,
): UsageRow | null {
	const values = recordOf(recordOf(data).usage);
	const inputTokens = numberOf(values.inputTokens) ?? 0;
	const outputTokens = numberOf(values.outputTokens) ?? 0;

	if (inputTokens === 0 && outputTokens === 0) return null;

	return { ...input, inputTokens, outputTokens };
}

export function recordOf(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export function numberOf(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
