import { describe, expect, it } from "bun:test";
import { decideDeploy } from "./deploy-guard";

describe("decideDeploy", () => {
	it("skips when the database has migrations unknown to this branch", () => {
		const result = decideDeploy(
			["20260101000000_init"],
			["20260101000000_init", "20260201000000_drop_companies"],
			{},
			false,
		);

		expect(result.action).toBe("skip");
		expect(result.reason).toContain("20260201000000_drop_companies");
	});

	it("skips pending destructive migrations without JANUS_ALLOW_DEPLOY", () => {
		const result = decideDeploy(
			["20260101000000_init", "20260301000000_drop_column"],
			["20260101000000_init"],
			{ "20260301000000_drop_column": "ALTER TABLE foo DROP COLUMN bar;" },
			false,
		);

		expect(result.action).toBe("skip");
		expect(result.reason).toContain("20260301000000_drop_column");
		expect(result.reason).toContain("JANUS_ALLOW_DEPLOY=1");
	});

	it("deploys pending destructive migrations when JANUS_ALLOW_DEPLOY is set", () => {
		const result = decideDeploy(
			["20260101000000_init", "20260301000000_drop_column"],
			["20260101000000_init"],
			{ "20260301000000_drop_column": "ALTER TABLE foo DROP COLUMN bar;" },
			true,
		);

		expect(result.action).toBe("deploy");
	});

	it("deploys pending additive migrations", () => {
		const result = decideDeploy(
			["20260101000000_init", "20260301000000_add_table"],
			["20260101000000_init"],
			{ "20260301000000_add_table": "CREATE TABLE foo (id text);" },
			false,
		);

		expect(result.action).toBe("deploy");
	});

	it("deploys on a fresh database with nothing applied", () => {
		const result = decideDeploy(
			["20260101000000_init", "20260201000000_next"],
			[],
			{},
			false,
		);

		expect(result.action).toBe("deploy");
	});
});
