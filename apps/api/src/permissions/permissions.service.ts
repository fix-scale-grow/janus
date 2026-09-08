import {
	canManagePermissions,
	isWorkspaceAdmin,
	toWorkspaceRole,
	WORKSPACE_ID,
	workspaceRoleOf,
} from "@crm/auth";
import type { Db } from "@crm/db";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "./permissions.config";
import type { PermissionGrantInput } from "./permissions.contracts";

@Injectable()
export class PermissionsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
		const role = await workspaceRoleOf(userId, this.db);
		if (isWorkspaceAdmin(role)) return true;
		const row = await this.db.userPermission.findUnique({
			where: { userId_key: { userId, key } },
			select: { id: true },
		});
		return row !== null;
	}

	async assertPermission(userId: string, key: PermissionKey): Promise<void> {
		if (!(await this.hasPermission(userId, key))) {
			throw new ForbiddenException("You do not have access to profit data.");
		}
	}

	async mine(userId: string) {
		const role = await workspaceRoleOf(userId, this.db);
		if (isWorkspaceAdmin(role)) {
			return { keys: [...ALL_PERMISSION_KEYS], isAdmin: true };
		}
		const rows = await this.db.userPermission.findMany({
			where: { userId },
			select: { key: true },
		});
		return { keys: rows.map((row) => row.key), isAdmin: false };
	}

	private async assertManager(actorId: string): Promise<void> {
		const role = await workspaceRoleOf(actorId, this.db);
		if (!canManagePermissions(role)) {
			throw new ForbiddenException("Only an admin can change permissions.");
		}
	}

	async grant(actorId: string, input: PermissionGrantInput) {
		await this.assertManager(actorId);
		return this.db.userPermission.upsert({
			where: { userId_key: { userId: input.userId, key: input.key } },
			update: {},
			create: { userId: input.userId, key: input.key, grantedById: actorId },
		});
	}

	async revoke(actorId: string, input: PermissionGrantInput) {
		await this.assertManager(actorId);
		await this.db.userPermission.deleteMany({
			where: { userId: input.userId, key: input.key },
		});
		return { ok: true };
	}

	async listUsers(actorId: string) {
		await this.assertManager(actorId);
		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: {
				role: true,
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						permissions: { select: { key: true } },
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});
		return members.map((member) => ({
			userId: member.user.id,
			name: member.user.name,
			email: member.user.email,
			image: member.user.image,
			role: toWorkspaceRole(member.role),
			keys: member.user.permissions.map((permission) => permission.key),
		}));
	}
}
