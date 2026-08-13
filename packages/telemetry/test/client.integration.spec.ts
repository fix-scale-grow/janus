import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	capture,
	captureNow,
	flushTelemetry,
	resetTelemetryClient,
	shutdownTelemetry,
} from "../src/client";

// Janus fork: telemetry is stripped. Upstream this file asserted that events
// were delivered over the network to trycomp.ai's PostHog. The contract now is
// the opposite and non-negotiable: the client is inert and NOTHING ever leaves
// the process. This spec fails the moment any code path tries to phone home.

const realFetch = globalThis.fetch;

let calls: string[] = [];

beforeEach(() => {
	calls = [];
	// Any fetch at all is a telemetry leak — record the URL so we can assert none.
	globalThis.fetch = (async (input: unknown) => {
		calls.push(String(input));
		return new Response("{}", { status: 200 });
	}) as typeof fetch;
	resetTelemetryClient();
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("stripped telemetry client", () => {
	it("capture is a no-op and makes no network call", () => {
		capture("install_daily", { crm_version: "1.0.0" });
		expect(calls.length).toBe(0);
	});

	it("captureNow reports not-sent and makes no network call", async () => {
		expect(await captureNow("install_daily", { crm_version: "1.0.0" })).toBe(
			false,
		);
		expect(calls.length).toBe(0);
	});

	it("sends nothing regardless of the disable env vars", async () => {
		for (const [name, value] of [
			["CRM_TELEMETRY_DISABLED", "0"],
			["DO_NOT_TRACK", "0"],
			["NODE_ENV", "production"],
		] as const) {
			const prev = process.env[name];
			process.env[name] = value;
			resetTelemetryClient();

			expect(await captureNow("install_daily", { crm_version: "1.0.0" })).toBe(
				false,
			);

			if (prev === undefined) delete process.env[name];
			else process.env[name] = prev;
		}

		expect(calls.length).toBe(0);
	});

	it("flush and shutdown are safe no-ops", async () => {
		await expect(flushTelemetry()).resolves.toBeUndefined();
		await expect(shutdownTelemetry()).resolves.toBeUndefined();
		expect(calls.length).toBe(0);
	});
});
