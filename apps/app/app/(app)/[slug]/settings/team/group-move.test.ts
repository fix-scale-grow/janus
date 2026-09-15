import { describe, expect, test } from "bun:test";
import {
	groupMoveCopy,
	groupMoveFailure,
	needsGroupMoveConfirm,
} from "./group-move";

const base = {
	memberId: "m1",
	name: "Rick",
	groupId: "g1",
	groupName: "Office",
};

describe("needsGroupMoveConfirm", () => {
	test("owners always confirm", () => {
		expect(needsGroupMoveConfirm({ role: "owner", isViewer: false })).toBe(
			true,
		);
	});

	test("an admin moving their own row confirms", () => {
		expect(needsGroupMoveConfirm({ role: "admin", isViewer: true })).toBe(true);
	});

	test("an admin moving someone else does not confirm", () => {
		expect(needsGroupMoveConfirm({ role: "admin", isViewer: false })).toBe(
			false,
		);
		expect(needsGroupMoveConfirm({ role: "member", isViewer: false })).toBe(
			false,
		);
	});
});

describe("groupMoveCopy", () => {
	test("owner of another row", () => {
		expect(groupMoveCopy({ ...base, demoteOwner: true, self: false })).toEqual({
			title: "Make Rick a member of Office?",
			description: "They stop being an owner.",
		});
	});

	test("owner moving their own row", () => {
		expect(groupMoveCopy({ ...base, demoteOwner: true, self: true })).toEqual({
			title: "Make Rick a member of Office?",
			description:
				"You stop being an owner. You will lose admin access right away.",
		});
	});

	test("admin moving their own row", () => {
		expect(groupMoveCopy({ ...base, demoteOwner: false, self: true })).toEqual({
			title: "Make Rick a member of Office?",
			description: "You will lose admin access right away.",
		});
	});
});

describe("groupMoveFailure", () => {
	test("failure after the owner became an admin names both steps", () => {
		expect(groupMoveFailure(base, "adminSet", "Group is gone")).toBe(
			"Rick is now an Admin. Adding them to Office failed: Group is gone",
		);
	});

	test("failure before any change shows the message", () => {
		expect(groupMoveFailure(base, "none", "Keep one owner")).toBe(
			"Keep one owner",
		);
	});
});
