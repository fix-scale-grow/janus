import { describe, expect, test } from "bun:test";
import { dialHref, reachableContact } from "./dial";

describe("dialHref", () => {
	test("strips display punctuation, keeps digits", () => {
		expect(dialHref("(555) 123-4567")).toBe("5551234567");
	});

	test("keeps a single leading country-code +", () => {
		expect(dialHref("+1 (555) 123-4567")).toBe("+15551234567");
	});

	test("drops dots and spaces", () => {
		expect(dialHref("555.123.4567")).toBe("5551234567");
	});

	test("preserves every digit of a trunk-code number (no (0) stripping)", () => {
		// UK +44 (0)20 7946 0018 — the (0) is kept on purpose; dropping it could
		// corrupt a legitimate number, so every digit survives.
		expect(dialHref("+44 (0)20 7946 0018")).toBe("+4402079460018");
	});

	test("collapses an interior + into the single leading one", () => {
		expect(dialHref("+1+555")).toBe("+1555");
	});

	test("removes a stray + when there is no leading one", () => {
		expect(dialHref("555+123")).toBe("555123");
	});
});

describe("reachableContact", () => {
	test("returns the first contact with a real phone", () => {
		const contacts = [
			{ id: "a", phone: null },
			{ id: "b", phone: "   " },
			{ id: "c", phone: "555-0100" },
			{ id: "d", phone: "555-0199" },
		];
		expect(reachableContact(contacts)?.id).toBe("c");
	});

	test("returns null when no contact has a phone", () => {
		expect(reachableContact([{ id: "a", phone: null }])).toBeNull();
	});

	test("returns null for an empty list", () => {
		expect(reachableContact([])).toBeNull();
	});
});
