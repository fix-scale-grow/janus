import { type Db, Prisma as PrismaNamespace } from "@crm/db";
import type { AccessScope, AccessSurface } from "@crm/db/access-config";
import {
	type AccessPrincipal,
	accessPolicySchema,
	parseAccessPolicy,
} from "@crm/db/access-policy";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { AccessService } from "../access/access.service";
import { InjectDatabase } from "../database/database.constants";
import { lockOwnersAndCheck } from "../workspace/workspace.service";
import type {
	AccessGroupIdInput,
	AccessGroupInput,
	AccessGroupUpdateInput,
	SetMemberAccessInput,
} from "./access-groups.contracts";

export interface AccessGroupRow {
	id: string;
	name: string;
	surface: AccessSurface;
	scope: AccessScope;
	policy: ReturnType<typeof parseAccessPolicy>;
	memberCount: number;
	seedKey: string | null;
}

function isUniqueNameConflict(error: unknown): boolean {
	return (
		error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

@Injectable()
export class AccessGroupsService {
	private readonly logger = new Logger(AccessGroupsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AccessService,
	) {}

	async list(p: AccessPrincipal): Promise<AccessGroupRow[]> {
		this.access.assertAdmin(p);

		const rows = await this.db.accessGroup.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				surface: true,
				scope: true,
				policy: true,
				seedKey: true,
				_count: { select: { members: true } },
			},
		});

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			surface: row.surface as AccessSurface,
			scope: row.scope as AccessScope,
			policy: parseAccessPolicy(row.policy, row.name),
			memberCount: row._count.members,
			seedKey: row.seedKey,
		}));
	}

	async create(
		input: AccessGroupInput,
		p: AccessPrincipal,
	): Promise<{ id: string }> {
		this.access.assertAdmin(p);

		try {
			const row = await this.db.accessGroup.create({
				data: {
					name: input.name,
					surface: input.surface,
					scope: input.scope,
					policy: input.policy as unknown as PrismaNamespace.InputJsonValue,
				},
				select: { id: true },
			});

			this.logger.log({
				message: "Access group changed",
				userId: p.userId,
				groupId: row.id,
				action: "create",
			});

			return { id: row.id };
		} catch (error) {
			if (isUniqueNameConflict(error)) {
				throw new ConflictException("A group with that name already exists.");
			}
			throw error;
		}
	}

	async update(
		input: AccessGroupUpdateInput,
		p: AccessPrincipal,
	): Promise<{ id: string; affected: number }> {
		this.access.assertAdmin(p);

		const policy = accessPolicySchema.parse(input.policy);

		try {
			const affected = await this.db.$transaction(async (tx) => {
				const existing = await tx.accessGroup.findUnique({
					where: { id: input.id },
					select: { id: true },
				});
				if (!existing) this.access.notFound("access group");

				await tx.accessGroup.update({
					where: { id: input.id },
					data: {
						name: input.name,
						surface: input.surface,
						scope: input.scope,
						policy: policy as unknown as PrismaNamespace.InputJsonValue,
					},
				});

				return tx.member.count({ where: { groupId: input.id } });
			});

			this.logger.log({
				message: "Access group changed",
				userId: p.userId,
				groupId: input.id,
				action: "update",
			});

			return { id: input.id, affected };
		} catch (error) {
			if (isUniqueNameConflict(error)) {
				throw new ConflictException("A group with that name already exists.");
			}
			throw error;
		}
	}

	async delete(
		input: AccessGroupIdInput,
		p: AccessPrincipal,
	): Promise<{ ok: true }> {
		this.access.assertAdmin(p);

		const group = await this.db.accessGroup.findUnique({
			where: { id: input.id },
			select: { id: true, _count: { select: { members: true } } },
		});
		if (!group) this.access.notFound("access group");

		if (group._count.members > 0) {
			throw new ConflictException(
				"Move this group's people to another group first.",
			);
		}

		await this.db.accessGroup.delete({ where: { id: input.id } });

		this.logger.log({
			message: "Access group changed",
			userId: p.userId,
			groupId: input.id,
			action: "delete",
		});

		return { ok: true };
	}

	async setMemberAccess(
		input: SetMemberAccessInput,
		p: AccessPrincipal,
	): Promise<{ ok: true }> {
		this.access.assertAdmin(p);

		await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: input.memberId, organizationId: WORKSPACE_ID },
				select: { id: true, role: true },
			});
			if (!target) this.access.notFound("member");

			if (input.access.kind === "group") {
				const group = await tx.accessGroup.findUnique({
					where: { id: input.access.groupId },
					select: { id: true },
				});
				if (!group) this.access.notFound("access group");
			}

			if (target.role === "owner") {
				await lockOwnersAndCheck(tx);
			}

			await tx.member.update({
				where: { id: target.id },
				data:
					input.access.kind === "admin"
						? { role: "admin", groupId: null }
						: { role: "member", groupId: input.access.groupId },
			});
		});

		this.logger.log({
			message: "Member access changed",
			userId: p.userId,
			memberId: input.memberId,
			access: input.access,
		});

		return { ok: true };
	}
}
