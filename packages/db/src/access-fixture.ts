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
	clerkEstimateId: string;
	otherEstimateId: string;
	looseEstimateByClerkId: string;
	looseEstimateByAdminId: string;
	clerkInvoiceId: string;
	otherInvoiceId: string;
	clerkContractId: string;
	otherContractId: string;
	otherDrawingId: string;
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
	const clerkEstimate = await db.estimate.create({
		data: {
			title: `Clerk estimate ${suffix}`,
			dealId: clerkDeal.id,
			createdById: users.clerk.id,
		},
		select: { id: true },
	});
	const otherEstimate = await db.estimate.create({
		data: {
			title: `Other estimate ${suffix}`,
			dealId: otherDeal.id,
			createdById: users.admin.id,
		},
		select: { id: true },
	});
	const looseEstimateByClerk = await db.estimate.create({
		data: {
			title: `Loose clerk estimate ${suffix}`,
			createdById: users.clerk.id,
		},
		select: { id: true },
	});
	const looseEstimateByAdmin = await db.estimate.create({
		data: {
			title: `Loose admin estimate ${suffix}`,
			createdById: users.admin.id,
		},
		select: { id: true },
	});
	const clerkInvoice = await db.invoice.create({
		data: {
			dealId: clerkDeal.id,
			createdById: users.clerk.id,
		},
		select: { id: true },
	});
	const otherInvoice = await db.invoice.create({
		data: {
			dealId: otherDeal.id,
			createdById: users.admin.id,
		},
		select: { id: true },
	});
	const clerkContract = await db.contract.create({
		data: {
			title: `Clerk contract ${suffix}`,
			dealId: clerkDeal.id,
			body: [],
			createdById: users.clerk.id,
		},
		select: { id: true },
	});
	const otherContract = await db.contract.create({
		data: {
			title: `Other contract ${suffix}`,
			dealId: otherDeal.id,
			body: [],
			createdById: users.admin.id,
		},
		select: { id: true },
	});
	const otherDrawing = await db.drawing.create({
		data: {
			title: `Other drawing ${suffix}`,
			scene: {},
			dealId: otherDeal.id,
			createdById: users.admin.id,
		},
		select: { id: true },
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
		clerkEstimateId: clerkEstimate.id,
		otherEstimateId: otherEstimate.id,
		looseEstimateByClerkId: looseEstimateByClerk.id,
		looseEstimateByAdminId: looseEstimateByAdmin.id,
		clerkInvoiceId: clerkInvoice.id,
		otherInvoiceId: otherInvoice.id,
		clerkContractId: clerkContract.id,
		otherContractId: otherContract.id,
		otherDrawingId: otherDrawing.id,
		async cleanup() {
			const userIds = Object.values(users).map((u) => u.id);
			await db.contract.deleteMany({
				where: {
					id: { in: [clerkContract.id, otherContract.id] },
				},
			});
			await db.invoice.deleteMany({
				where: { id: { in: [clerkInvoice.id, otherInvoice.id] } },
			});
			await db.drawing.deleteMany({
				where: { id: otherDrawing.id },
			});
			await db.estimate.deleteMany({
				where: {
					id: {
						in: [
							clerkEstimate.id,
							otherEstimate.id,
							looseEstimateByClerk.id,
							looseEstimateByAdmin.id,
						],
					},
				},
			});
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
