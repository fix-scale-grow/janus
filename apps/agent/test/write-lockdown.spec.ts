import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const TOOLS_DIR = join(import.meta.dir, "../agent/tools");

const DISABLED_TOOLS = new Set(["agent.ts"]);

const GATED_BY_APPROVAL_CARD = new Set([
	"archive_field.ts",
	"propose_drawing_tags.ts",
	"propose_estimate_lines.ts",
	"record_job_change.ts",
	"update_service.ts",
]);

const GATED_BY_EXECUTE_CHECK = new Set([
	"attach_drawing.ts",
	"manage_fields.ts",
	"set_field_value.ts",
]);

const FREE_TOOLS = new Set([
	"identify_contact.ts",
	"list_deals.ts",
	"list_drawings.ts",
	"list_fields.ts",
	"list_outstanding_work.ts",
	"read_crm_history.ts",
	"read_deal_history.ts",
	"read_drawing.ts",
	"read_estimate.ts",
	"read_price_book.ts",
	"record_fact.ts",
	"research_person.ts",
	"review_drawing.ts",
	"schedule_recheck.ts",
	"search_crm.ts",
	"set_chat_title.ts",
	"write_brief.ts",
	"write_workspace_profile.ts",
]);

const EXECUTE_CHECK_CASES: Record<
	string,
	{ input: Record<string, unknown>; expected: Record<string, unknown> }
> = {
	"attach_drawing.ts": {
		input: { drawingId: "drawing1" },
		expected: {
			attached: false,
			reason: expect.stringContaining("Not something to do unattended"),
		},
	},
	"manage_fields.ts": {
		input: { action: "create", entity: "CONTACT", label: "Test", type: "TEXT" },
		expected: {
			created: false,
			reason: expect.stringContaining("Not something to do unattended"),
		},
	},
	"set_field_value.ts": {
		input: {
			entity: "CONTACT",
			recordId: "contact1",
			key: "test",
			value: "x",
		},
		expected: {
			written: false,
			reason: expect.stringContaining("Not something to do unattended"),
		},
	},
};

function automatedSession() {
	return {
		auth: {
			current: {
				authenticator: "app",
				principalId: "eve:app",
				principalType: "runtime",
				attributes: {},
			},
			initiator: null,
		},
	};
}

function interactiveSession() {
	return {
		auth: {
			current: {
				authenticator: "better-auth",
				principalId: "user1",
				principalType: "user",
				attributes: {},
			},
			initiator: null,
		},
	};
}

function approvalCall(toolName: string, session: unknown) {
	return {
		session,
		toolName,
		toolInput: {},
		approvedTools: [],
		callId: "call1",
	} as never;
}

describe("every tool file is classified for the unattended write lockdown", () => {
	it("has no unclassified file in tools/ — a new one must be sorted into a bucket above", () => {
		const files = readdirSync(TOOLS_DIR).filter((entry) =>
			entry.endsWith(".ts"),
		);
		const classified = new Set([
			...DISABLED_TOOLS,
			...GATED_BY_APPROVAL_CARD,
			...GATED_BY_EXECUTE_CHECK,
			...FREE_TOOLS,
		]);

		const unclassified = files.filter((file) => !classified.has(file));
		expect(unclassified).toEqual([]);
	});
});

describe("approval-card write tools deny an unattended (APP_AUTH) session", () => {
	for (const file of GATED_BY_APPROVAL_CARD) {
		it(`${file} refuses via its approval policy, before touching the database`, async () => {
			const tool = (await import(join(TOOLS_DIR, file))).default;

			expect(typeof tool.approval).toBe("function");

			const denied = await tool.approval(
				approvalCall(file, automatedSession()),
			);
			expect(denied).toMatchObject({ type: "denied" });

			const asked = await tool.approval(
				approvalCall(file, interactiveSession()),
			);
			expect(asked).toBe("user-approval");
		});
	}
});

describe("reversible write tools deny an unattended (APP_AUTH) session in execute", () => {
	for (const file of GATED_BY_EXECUTE_CHECK) {
		it(`${file} refuses before touching the database`, async () => {
			const tool = (await import(join(TOOLS_DIR, file))).default;
			const testCase = EXECUTE_CHECK_CASES[file];

			expect(tool.approval).toBeUndefined();

			const result = await tool.execute(testCase.input, {
				session: automatedSession(),
			} as never);

			expect(result).toMatchObject(testCase.expected);
		});
	}
});
