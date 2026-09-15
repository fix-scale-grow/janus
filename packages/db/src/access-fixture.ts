import type { AccessPrincipal } from "./access-policy";
import { ensureAccessGroups, resolvePrincipal } from "./access-resolve";
import { db } from "./client";
import { WORKSPACE_ID } from "./workspace";

export type AccessFixture = {
	admin: AccessPrincipal;
	clerk: AccessPrincipal;
	office: AccessPrincipal;
	crew: AccessPrincipal;
	adminId: string;
	clerkId: string;
	clerkDealId: string;
	otherDealId: string;
	clerkContactId: string;
	otherContactId: string;
	cleanup(): Promise<void>;
};

export async function createAccessFixture(
	suffix: string,
): Promise<AccessFixture> {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});
	await ensureAccessGroups(db);
	const groups = await db.accessGroup.findMany({
		where: { seedKey: { not: null } },
	});
	const groupId = (key: string) => {
		const row = groups.find((g) => g.seedKey === key);
		if (!row) throw new Error(`seed group ${key} missing`);
		return row.id;
	};
	const users = {
		admin: {
			id: `acc-admin-${suffix}`,
			role: "owner",
			groupId: null as string | null,
		},
		clerk: {
			id: `acc-clerk-${suffix}`,
			role: "member",
			groupId: groupId("sales-clerk"),
		},
		office: {
			id: `acc-office-${suffix}`,
			role: "member",
			groupId: groupId("office"),
		},
		crew: {
			id: `acc-crew-${suffix}`,
			role: "member",
			groupId: groupId("crew-lead"),
		},
	};
	for (const u of Object.values(users)) {
		await db.user.create({
			data: { id: u.id, name: u.id, email: `${u.id}@example.test` },
		});
		await db.member.create({
			data: {
				id: `m-${u.id}`,
				organizationId: WORKSPACE_ID,
				userId: u.id,
				role: u.role,
				groupId: u.groupId,
				createdAt: new Date(),
			},
		});
	}
	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
	});
	const clerkDeal = await db.deal.create({
		data: {
			name: `Clerk deal ${suffix}`,
			ownerId: users.clerk.id,
			stageId: stage.id,
		},
		select: { id: true },
	});
	const otherDeal = await db.deal.create({
		data: {
			name: `Other deal ${suffix}`,
			ownerId: users.admin.id,
			stageId: stage.id,
		},
		select: { id: true },
	});
	const clerkContact = await db.contact.create({
		data: { firstName: `Clerk`, lastName: `Contact ${suffix}` },
		select: { id: true },
	});
	const otherContact = await db.contact.create({
		data: { firstName: `Other`, lastName: `Contact ${suffix}` },
		select: { id: true },
	});
	await db.dealContact.createMany({
		data: [
			{ dealId: clerkDeal.id, contactId: clerkContact.id },
			{ dealId: otherDeal.id, contactId: otherContact.id },
		],
	});
	const resolve = async (id: string) => {
		const p = await resolvePrincipal(db, id);
		if (!p) throw new Error(`principal ${id} missing`);
		return p;
	};
	return {
		admin: await resolve(users.admin.id),
		clerk: await resolve(users.clerk.id),
		office: await resolve(users.office.id),
		crew: await resolve(users.crew.id),
		adminId: users.admin.id,
		clerkId: users.clerk.id,
		clerkDealId: clerkDeal.id,
		otherDealId: otherDeal.id,
		clerkContactId: clerkContact.id,
		otherContactId: otherContact.id,
		async cleanup() {
			const userIds = Object.values(users).map((u) => u.id);
			await db.dealContact.deleteMany({
				where: { dealId: { in: [clerkDeal.id, otherDeal.id] } },
			});
			await db.deal.deleteMany({
				where: { id: { in: [clerkDeal.id, otherDeal.id] } },
			});
			await db.contact.deleteMany({
				where: { id: { in: [clerkContact.id, otherContact.id] } },
			});
			await db.member.deleteMany({ where: { userId: { in: userIds } } });
			await db.user.deleteMany({ where: { id: { in: userIds } } });
		},
	};
}
