import { ACCESS, type AccessScope, type AccessSurface } from "./access-config";
import {
	type AccessPrincipal,
	adminPrincipal,
	noAccessPrincipal,
	parseAccessPolicy,
} from "./access-policy";
import type { Db } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { SETTINGS_ID } from "./settings";
import { WORKSPACE_ID } from "./workspace";

type Client = Db | Prisma.TransactionClient;

const LEGACY_PROFIT_KEY = "profit.view";

export async function ensureAccessGroups(client: Db): Promise<void> {
	await client.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('access_group_seed'))`;
		const setting = await tx.appSetting.findUnique({
			where: { id: SETTINGS_ID },
			select: { accessGroupsSeededAt: true },
		});
		if (setting?.accessGroupsSeededAt) return;
		const seededAt = new Date();
		await tx.appSetting.upsert({
			where: { id: SETTINGS_ID },
			create: { id: SETTINGS_ID, accessGroupsSeededAt: seededAt },
			update: { accessGroupsSeededAt: seededAt },
		});
		if ((await tx.accessGroup.count()) > 0) return;

		const created = new Map<string, string>();
		for (const seed of ACCESS.seedGroups) {
			const row = await tx.accessGroup.create({
				data: {
					name: seed.name,
					seedKey: seed.key,
					surface: seed.surface,
					scope: seed.scope,
					policy: seed.policy as unknown as Prisma.InputJsonValue,
				},
				select: { id: true },
			});
			created.set(seed.key, row.id);
		}

		const plain = await tx.member.findMany({
			where: { organizationId: WORKSPACE_ID, role: "member", groupId: null },
			select: { id: true, userId: true },
		});
		if (plain.length === 0) return;

		const profitHolders = new Set(
			(
				await tx.userPermission.findMany({
					where: {
						key: LEGACY_PROFIT_KEY,
						userId: { in: plain.map((m) => m.userId) },
					},
					select: { userId: true },
				})
			).map((row) => row.userId),
		);

		const office = ACCESS.seedGroups.find((g) => g.key === "office");
		if (!office) throw new Error("Office seed group is missing from ACCESS.");
		const officeId = created.get("office") as string;

		let profitGroupId: string | null = null;
		if (profitHolders.size > 0) {
			const row = await tx.accessGroup.create({
				data: {
					name: ACCESS.legacyProfitGroupName,
					surface: office.surface,
					scope: office.scope,
					policy: {
						...office.policy,
						money: [...office.policy.money, "profit"],
					} as unknown as Prisma.InputJsonValue,
				},
				select: { id: true },
			});
			profitGroupId = row.id;
		}

		for (const m of plain) {
			await tx.member.update({
				where: { id: m.id },
				data: {
					groupId:
						profitHolders.has(m.userId) && profitGroupId
							? profitGroupId
							: officeId,
				},
			});
		}
	});
}

export async function resolvePrincipal(
	client: Client,
	userId: string,
): Promise<AccessPrincipal | null> {
	const member = await client.member.findUnique({
		where: { organizationId_userId: { organizationId: WORKSPACE_ID, userId } },
		select: {
			role: true,
			group: {
				select: {
					id: true,
					name: true,
					surface: true,
					scope: true,
					policy: true,
				},
			},
		},
	});
	if (!member) return null;
	if (member.role === "owner" || member.role === "admin")
		return adminPrincipal(userId);
	if (!member.group) return noAccessPrincipal(userId);
	return {
		userId,
		isAdmin: false,
		groupId: member.group.id,
		groupName: member.group.name,
		surface: parseSurface(member.group.surface, member.group.name),
		scope: parseScope(member.group.scope, member.group.name),
		policy: parseAccessPolicy(member.group.policy, member.group.name),
	};
}

function parseSurface(value: string, groupName: string): AccessSurface {
	if ((ACCESS.surfaces as readonly string[]).includes(value))
		return value as AccessSurface;
	throw new Error(
		`Access group "${groupName}" has an unknown surface "${value}".`,
	);
}

function parseScope(value: string, groupName: string): AccessScope {
	if ((ACCESS.scopes as readonly string[]).includes(value))
		return value as AccessScope;
	throw new Error(
		`Access group "${groupName}" has an unknown scope "${value}".`,
	);
}
