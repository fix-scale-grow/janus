import { describe, expect, it } from "bun:test";
import { resolveProvider } from "../agent/lib/anthropic-provider";

describe("resolveProvider", () => {
	it("uses the API key when only the API key is set", () => {
		expect(resolveProvider({ ANTHROPIC_API_KEY: "sk-ant-test" })).toEqual({
			kind: "api-key",
			apiKey: "sk-ant-test",
		});
	});

	it("uses the OAuth token when only the OAuth token is set", () => {
		expect(resolveProvider({ CLAUDE_CODE_OAUTH_TOKEN: "oauth-test" })).toEqual({
			kind: "oauth",
			token: "oauth-test",
		});
	});

	it("the API key wins when both are set", () => {
		expect(
			resolveProvider({
				ANTHROPIC_API_KEY: "sk-ant-test",
				CLAUDE_CODE_OAUTH_TOKEN: "oauth-test",
			}),
		).toEqual({ kind: "api-key", apiKey: "sk-ant-test" });
	});

	it("is null when neither is set", () => {
		expect(resolveProvider({})).toBeNull();
	});

	it("treats blank and whitespace as unset", () => {
		expect(
			resolveProvider({
				ANTHROPIC_API_KEY: "   ",
				CLAUDE_CODE_OAUTH_TOKEN: "oauth-test",
			}),
		).toEqual({ kind: "oauth", token: "oauth-test" });

		expect(
			resolveProvider({
				ANTHROPIC_API_KEY: "  ",
				CLAUDE_CODE_OAUTH_TOKEN: " ",
			}),
		).toBeNull();
	});
});
