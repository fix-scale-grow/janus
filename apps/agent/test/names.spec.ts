import { describe, expect, it } from "bun:test";

import { nameMatchesLocalPart } from "../agent/lib/names";

describe("nameMatchesLocalPart", () => {
	const person = (firstName: string, lastName: string) => ({
		firstName,
		lastName,
	});

	it("accepts the initial-plus-surname form", () => {
		expect(
			nameMatchesLocalPart(person("Paula", "Marchetti"), "pmarchetti"),
		).toBe(true);
		expect(nameMatchesLocalPart(person("Tomi", "Okonkwo"), "tokonkwo")).toBe(
			true,
		);
	});

	it("accepts first-name-only and run-together forms", () => {
		expect(nameMatchesLocalPart(person("Nathan", "Owen"), "nathan")).toBe(true);
		expect(nameMatchesLocalPart(person("Jane", "Doe"), "janedoe")).toBe(true);
	});

	it("rejects a stranger who merely turned up in the results", () => {
		expect(
			nameMatchesLocalPart(person("Antonio", "Fontana"), "pmarchetti"),
		).toBe(false);
		expect(nameMatchesLocalPart(person("Preeti", "Duarte"), "tokonkwo")).toBe(
			false,
		);
	});

	it("rejects when the profile carries no name at all", () => {
		expect(
			nameMatchesLocalPart({ firstName: null, lastName: null }, "pmarchetti"),
		).toBe(false);
	});
});
