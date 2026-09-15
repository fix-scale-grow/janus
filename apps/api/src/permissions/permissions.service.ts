import type { AccessPrincipal } from "@crm/db/access-policy";
import { Injectable } from "@nestjs/common";

export interface MinePermissions {
	isAdmin: boolean;
	groupId: string | null;
	groupName: string | null;
	surface: AccessPrincipal["surface"];
	scope: AccessPrincipal["scope"];
	areas: AccessPrincipal["policy"]["areas"];
	actions: AccessPrincipal["policy"]["actions"];
	money: AccessPrincipal["policy"]["money"];
}

@Injectable()
export class PermissionsService {
	mine(p: AccessPrincipal): MinePermissions {
		return {
			isAdmin: p.isAdmin,
			groupId: p.groupId,
			groupName: p.groupName,
			surface: p.surface,
			scope: p.scope,
			areas: p.policy.areas,
			actions: p.policy.actions,
			money: p.policy.money,
		};
	}
}
