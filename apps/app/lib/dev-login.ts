import { isWorkspaceRole, type WorkspaceRole } from "@crm/auth";
import { db } from "@crm/db";
import { ensureAccessGroups } from "@crm/db/access-resolve";

const ID_HASH_HEX_LENGTH = 32;

export async function stableUserId(email: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(email.trim().toLowerCase()),
	);
	const hex = Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `dev-${hex.slice(0, ID_HASH_HEX_LENGTH)}`;
}

export function parseWorkspaceRole(value: string): WorkspaceRole | null {
	return isWorkspaceRole(value) ? value : null;
}

export async function resolveGroupId(
	name: string,
): Promise<string | null | undefined> {
	if (name.toLowerCase() === "none") return null;
	await ensureAccessGroups(db);
	const group = await db.accessGroup.findFirst({
		where: {
			OR: [{ seedKey: name }, { name: { equals: name, mode: "insensitive" } }],
		},
		select: { id: true },
	});
	return group?.id;
}
