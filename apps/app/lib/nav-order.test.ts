import { describe, expect, it } from "bun:test";
import { applyNavOrder } from "./nav-order";

const items = [
	{ href: "/", title: "Dashboard" },
	{ href: "/chat", title: "Janus AI" },
	{ href: "/contacts", title: "Contacts" },
	{ href: "/deals", title: "Sales" },
];

describe("applyNavOrder", () => {
	it("returns canonical order when no saved order exists", () => {
		expect(applyNavOrder(items, undefined).map((item) => item.href)).toEqual([
			"/",
			"/chat",
			"/contacts",
			"/deals",
		]);
	});

	it("applies a full saved order", () => {
		const order = ["/deals", "/contacts", "/", "/chat"];

		expect(applyNavOrder(items, order).map((item) => item.href)).toEqual(order);
	});

	it("appends items missing from the saved order in canonical position", () => {
		const order = ["/deals", "/"];

		expect(applyNavOrder(items, order).map((item) => item.href)).toEqual([
			"/deals",
			"/",
			"/chat",
			"/contacts",
		]);
	});

	it("ignores saved ids that no longer exist", () => {
		const order = ["/gone", "/contacts", "/"];

		expect(applyNavOrder(items, order).map((item) => item.href)).toEqual([
			"/contacts",
			"/",
			"/chat",
			"/deals",
		]);
	});

	it("ignores duplicate ids in the saved order", () => {
		const order = ["/deals", "/deals", "/chat"];

		expect(applyNavOrder(items, order).map((item) => item.href)).toEqual([
			"/deals",
			"/chat",
			"/",
			"/contacts",
		]);
	});
});
