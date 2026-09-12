import { describe, expect, it } from "bun:test";
import { applyNavHidden, HIDE_PROOF, isChildHidden } from "./nav-children";

const items = [
	{ href: "/", title: "Dashboard" },
	{ href: "/contacts", title: "Contacts" },
	{ href: "/settings", title: "Settings" },
];

describe("applyNavHidden", () => {
	it("returns all items when hidden is undefined", () => {
		expect(applyNavHidden(items, undefined).map((item) => item.href)).toEqual([
			"/",
			"/contacts",
			"/settings",
		]);
	});

	it("removes hidden hrefs", () => {
		expect(
			applyNavHidden(items, ["/contacts"]).map((item) => item.href),
		).toEqual(["/", "/settings"]);
	});

	it("keeps settings even when listed as hidden", () => {
		expect(
			applyNavHidden(items, ["/settings", "/contacts"]).map(
				(item) => item.href,
			),
		).toEqual(["/", "/settings"]);
	});

	it("ignores hidden hrefs that do not exist", () => {
		expect(applyNavHidden(items, ["/gone"]).map((item) => item.href)).toEqual([
			"/",
			"/contacts",
			"/settings",
		]);
	});
});

describe("isChildHidden", () => {
	it("returns false when hidden is undefined", () => {
		expect(isChildHidden("/contacts:new", undefined)).toBe(false);
	});

	it("returns true when the child id is in the hidden list", () => {
		expect(isChildHidden("/contacts:new", ["/contacts:new"])).toBe(true);
	});

	it("returns false when the child id is not in the hidden list", () => {
		expect(isChildHidden("/contacts:new", ["/contacts:all"])).toBe(false);
	});
});

describe("HIDE_PROOF", () => {
	it("contains only settings", () => {
		expect(HIDE_PROOF).toEqual(["/settings"]);
	});
});
