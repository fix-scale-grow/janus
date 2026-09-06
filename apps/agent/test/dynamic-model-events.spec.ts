import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { db, type Prisma } from "@crm/db";
import { DEFAULT_AGENT_MODEL, SETTINGS_ID } from "@crm/db/settings";
import {
	DIRECT_ANTHROPIC,
	dynamicAgentModelEvents,
	type ModelSelection,
	selectedModelId,
} from "../agent/lib/model";
import { modelFor } from "../agent/lib/model-usage";

const ENV_KEYS = ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] as const;
const savedEnv: Record<string, string | undefined> = {};

async function clearSetting() {
	await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
}

let saved: Prisma.AppSettingUncheckedCreateInput | null = null;

beforeAll(async () => {
	saved = await db.appSetting.findUnique({ where: { id: SETTINGS_ID } });
});

beforeEach(async () => {
	for (const key of ENV_KEYS) {
		savedEnv[key] = process.env[key];
		delete process.env[key];
	}
	await clearSetting();
});

afterEach(async () => {
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) delete process.env[key];
		else process.env[key] = savedEnv[key];
	}
	await clearSetting();
});

afterAll(async () => {
	if (saved) await db.appSetting.create({ data: saved });
});

describe("dynamicAgentModelEvents", () => {
	it("resolves on session.started, not step.started, without a direct key", () => {
		const events = dynamicAgentModelEvents();

		expect(Object.keys(events)).toEqual(["session.started"]);
	});

	it("resolves on step.started, not session.started, with a direct key", () => {
		process.env.ANTHROPIC_API_KEY = "sk-ant-test";

		const events = dynamicAgentModelEvents();

		expect(Object.keys(events)).toEqual(["step.started"]);
	});

	it("the step.started handler returns a live model selection, not a string", async () => {
		process.env.ANTHROPIC_API_KEY = "sk-ant-test";

		const events = dynamicAgentModelEvents();
		const handler = events["step.started"];
		expect(handler).toBeDefined();

		const selection = await handler?.(undefined, {
			session: { id: "sess_direct" },
		});

		expect(selection).not.toBeNull();
		expect(typeof selection?.model).not.toBe("string");
		expect(selection?.modelContextWindowTokens).toBe(200_000);

		if (selection && typeof selection.model !== "string") {
			expect(selection.model.modelId).toBe(DIRECT_ANTHROPIC.defaultModelId);
		}

		expect(modelFor("sess_direct")).toBe(DIRECT_ANTHROPIC.defaultModelId);
	});

	it("the session.started handler returns null and tracks the gateway fallback", async () => {
		const events = dynamicAgentModelEvents();
		const handler = events["session.started"];
		expect(handler).toBeDefined();

		const selection = await handler?.(undefined, {
			session: { id: "sess_gateway" },
		});

		expect(selection).toBeNull();
		expect(modelFor("sess_gateway")).toBe(DEFAULT_AGENT_MODEL.id);
	});
});

describe("selectedModelId", () => {
	it("falls back to the given id when there is no selection", () => {
		expect(selectedModelId(null, DEFAULT_AGENT_MODEL.id)).toBe(
			DEFAULT_AGENT_MODEL.id,
		);
	});

	it("reads a gateway string straight off the selection", () => {
		const selection: ModelSelection = {
			model: "anthropic/claude-sonnet-5",
			modelContextWindowTokens: 200_000,
		};

		expect(selectedModelId(selection, DEFAULT_AGENT_MODEL.id)).toBe(
			"anthropic/claude-sonnet-5",
		);
	});
});
