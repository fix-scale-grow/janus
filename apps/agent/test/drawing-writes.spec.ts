import { describe, expect, it } from "bun:test";
import type { DrawingScene } from "@crm/drawings";
import { mergeServiceTags } from "../agent/lib/drawing-writes";
import proposeDrawingTags from "../agent/tools/propose_drawing_tags";

function scene(
	elements: unknown[],
	satellite: DrawingScene["satellite"] = null,
): DrawingScene {
	return {
		excalidraw: { elements, appState: {}, files: {} },
		satellite,
	} as unknown as DrawingScene;
}

function area(id: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		isDeleted: false,
		customData: { scopeId: id, kind: "area", ...extra },
	};
}

describe("mergeServiceTags", () => {
	it("applies the tag's serviceId only to the matching scopeId", () => {
		const before = scene([
			area("s1", { label: "North slope" }),
			area("s2", { label: "South slope" }),
		]);

		const result = mergeServiceTags(before, [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
		]);

		const north = result.scene.excalidraw.elements[0] as {
			customData: { serviceId?: string };
		};
		const south = result.scene.excalidraw.elements[1] as {
			customData: { serviceId?: string };
		};

		expect(north.customData.serviceId).toBe("svc-tearoff");
		expect(south.customData.serviceId).toBeUndefined();
		expect(result.matched).toEqual(["s1"]);
		expect(result.unmatched).toEqual([]);
	});

	it("leaves every non-matching element byte-identical", () => {
		const before = scene([
			area("s1"),
			area("s2", { label: "Untouched", serviceId: "svc-existing" }),
			{
				id: "t1",
				type: "text",
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				isDeleted: false,
				text: "Customer note",
			},
		]);

		const result = mergeServiceTags(before, [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
		]);

		expect(JSON.stringify(result.scene.excalidraw.elements[1])).toBe(
			JSON.stringify(before.excalidraw.elements[1]),
		);
		expect(JSON.stringify(result.scene.excalidraw.elements[2])).toBe(
			JSON.stringify(before.excalidraw.elements[2]),
		);
	});

	it("preserves every other customData field on the matched element", () => {
		const before = scene([
			area("s1", {
				label: "North slope",
				pitch: "6/12",
				adj: { name: "steep", factor: 1.2 },
				linear: false,
			}),
		]);

		const result = mergeServiceTags(before, [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
		]);

		expect(result.scene.excalidraw.elements[0]).toEqual({
			...(before.excalidraw.elements[0] as Record<string, unknown>),
			customData: {
				scopeId: "s1",
				kind: "area",
				label: "North slope",
				pitch: "6/12",
				adj: { name: "steep", factor: 1.2 },
				linear: false,
				serviceId: "svc-tearoff",
			},
		});
	});

	it("reports a scopeId with no matching shape as unmatched", () => {
		const before = scene([area("s1")]);

		const result = mergeServiceTags(before, [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
			{ scopeId: "ghost", serviceId: "svc-gutters" },
		]);

		expect(result.matched).toEqual(["s1"]);
		expect(result.unmatched).toEqual(["ghost"]);
	});

	it("skips elements with no customData or an unparseable scope", () => {
		const before = scene([
			{ id: "raw1", type: "freedraw", x: 0, y: 0, width: 1, height: 1 },
			{
				id: "raw2",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				customData: { notAScope: true },
			},
		]);

		const result = mergeServiceTags(before, [
			{ scopeId: "raw1", serviceId: "svc-tearoff" },
		]);

		expect(result.matched).toEqual([]);
		expect(result.unmatched).toEqual(["raw1"]);
		expect(JSON.stringify(result.scene.excalidraw.elements)).toBe(
			JSON.stringify(before.excalidraw.elements),
		);
	});

	it("tags a satellite feature's scope by scopeId", () => {
		const before = scene([], {
			center: [0, 0],
			zoom: 18,
			features: [
				{
					id: "f1",
					kind: "area",
					coordinates: [],
					measured: { areaSqFt: 900 },
					scope: { scopeId: "sat1", kind: "area", label: "Garage roof" },
				},
			],
		});

		const result = mergeServiceTags(before, [
			{ scopeId: "sat1", serviceId: "svc-tearoff" },
		]);

		expect(result.matched).toEqual(["sat1"]);
		expect(result.scene.satellite?.features[0]?.scope?.serviceId).toBe(
			"svc-tearoff",
		);
	});
});

describe("propose_drawing_tags approval policy", () => {
	const input = {
		drawingId: "drawing1",
		tags: [
			{
				scopeId: "s1",
				shapeLabel: "long eave line",
				serviceId: "svc1",
				serviceName: "Drip edge",
				reason: "Matches the eave line label.",
			},
		],
	};

	it("requires a person's approval for an interactive session", async () => {
		const decision = await proposeDrawingTags.approval?.({
			session: {
				auth: {
					current: {
						authenticator: "better-auth",
						principalId: "user1",
						principalType: "user",
					},
					initiator: null,
				},
			},
			toolName: "propose_drawing_tags",
			toolInput: input,
			approvedTools: [],
			callId: "call1",
		} as never);

		expect(decision).toBe("user-approval");
	});

	it("refuses a dispatched session and never stalls", async () => {
		const decision = await proposeDrawingTags.approval?.({
			session: {
				auth: {
					current: {
						authenticator: "app",
						principalId: "eve:app",
						principalType: "runtime",
					},
					initiator: null,
				},
			},
			toolName: "propose_drawing_tags",
			toolInput: input,
			approvedTools: [],
			callId: "call2",
		} as never);

		expect(decision).toEqual({
			type: "denied",
			reason: expect.stringContaining("Propose the tags in chat"),
		});
	});
});
