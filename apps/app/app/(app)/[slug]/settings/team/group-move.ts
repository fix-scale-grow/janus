export type GroupMove = {
	memberId: string;
	name: string;
	groupId: string;
	groupName: string;
	demoteOwner: boolean;
	self: boolean;
};

export type GroupMoveProgress = "none" | "adminSet";

export function needsGroupMoveConfirm(row: {
	role: "owner" | "admin" | "member";
	isViewer: boolean;
}): boolean {
	return row.role === "owner" || (row.role === "admin" && row.isViewer);
}

export function groupMoveCopy(move: GroupMove): {
	title: string;
	description: string;
} {
	const lines = [
		move.demoteOwner
			? move.self
				? "You stop being an owner."
				: "They stop being an owner."
			: null,
		move.self ? "You will lose admin access right away." : null,
	].filter((line): line is string => line !== null);
	return {
		title: `Make ${move.name} a member of ${move.groupName}?`,
		description: lines.join(" "),
	};
}

export function groupMoveFailure(
	move: Pick<GroupMove, "name" | "groupName">,
	progress: GroupMoveProgress,
	message: string,
): string {
	return progress === "adminSet"
		? `${move.name} is now an Admin. Adding them to ${move.groupName} failed: ${message}`
		: message;
}
