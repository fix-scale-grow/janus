import "reflect-metadata";
import { describe, expect, it } from "bun:test";
import { validateEnv } from "../src/config/env.validation";

const BASE = {
	DATABASE_URL: "postgres://localhost:5432/crm",
	BETTER_AUTH_SECRET: "0123456789012345678901234567890123456789",
	ALLOWED_SIGN_IN: "example.test",
};

describe("APP_URL", () => {
	it("stops the API from booting in production without it", () => {
		expect(() => validateEnv({ ...BASE, NODE_ENV: "production" })).toThrow(
			/APP_URL/,
		);
	});

	it("boots in production with it", () => {
		const validated = validateEnv({
			...BASE,
			NODE_ENV: "production",
			APP_URL: "https://crm.example.com",
		});

		expect(validated.APP_URL).toBe("https://crm.example.com");
	});

	it("refuses an APP_URL that is not a URL", () => {
		expect(() =>
			validateEnv({
				...BASE,
				NODE_ENV: "development",
				APP_URL: "crm.example.com",
			}),
		).toThrow(/APP_URL/);
	});

	it("takes a comma-separated list of origins", () => {
		const validated = validateEnv({
			...BASE,
			NODE_ENV: "production",
			APP_URL: "https://crm.example.com, https://app.example.com",
		});

		expect(validated.APP_URL).toContain("app.example.com");
	});

	it("keeps the localhost default in development", () => {
		const validated = validateEnv({ ...BASE, NODE_ENV: "development" });

		expect(validated.APP_URL).toBeUndefined();
	});
});
