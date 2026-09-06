export type AnthropicProviderSelection =
	| { readonly kind: "api-key"; readonly apiKey: string }
	| { readonly kind: "oauth"; readonly token: string };

export function resolveProvider(
	env: Readonly<Record<string, string | undefined>>,
): AnthropicProviderSelection | null {
	const apiKey = env.ANTHROPIC_API_KEY?.trim();
	if (apiKey) return { kind: "api-key", apiKey };

	const token = env.CLAUDE_CODE_OAUTH_TOKEN?.trim();
	if (token) return { kind: "oauth", token };

	return null;
}
