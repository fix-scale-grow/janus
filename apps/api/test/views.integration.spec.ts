import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { ViewsService } from "../src/views/views.service";

const suffix = process.env.TEST_RUN_ID ?? "views-spec";
const prefix = `spec_${suffix}`;

const views = new ViewsService(db);

let userAId: string;
let userBId: string;

async function clean() {
	await db.userView.deleteMany({ where: { userId: { startsWith: prefix } } });
	await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
}

async function expectRejects(
	promise: Promise<unknown>,
	match?: RegExp,
): Promise<void> {
	let caught: unknown;

	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(Error);
	if (match) expect((caught as Error).message).toMatch(match);
}

beforeAll(async () => {
	await clean();

	const [userA, userB] = await Promise.all([
		db.user.create({
			data: {
				id: `${prefix}_a`,
				name: "Views Rep A",
				email: `a@${prefix}.test`,
			},
			select: { id: true },
		}),
		db.user.create({
			data: {
				id: `${prefix}_b`,
				name: "Views Rep B",
				email: `b@${prefix}.test`,
			},
			select: { id: true },
		}),
	]);
	userAId = userA.id;
	userBId = userB.id;
});

afterAll(async () => {
	await clean();
});

describe("get", () => {
	it("returns null when nothing has been saved", async () => {
		expect(await views.get(userAId, "deals")).toBeNull();
	});
});

describe("save + get round-trip", () => {
	it("saves then returns the same parsed state", async () => {
		const saved = await views.save(userAId, "deals", {
			sort: "createdAt",
			dir: "desc",
			tab: "open",
			facets: { owner: "u1" },
			hiddenColumns: ["createdAt"],
			pageSize: 50,
		});

		expect(saved).toEqual({
			sort: "createdAt",
			dir: "desc",
			tab: "open",
			facets: { owner: "u1" },
			hiddenColumns: ["createdAt"],
			pageSize: 50,
		});

		const fetched = await views.get(userAId, "deals");
		expect(fetched).toEqual(saved);
	});

	it("upserts on a second save for the same tableId", async () => {
		await views.save(userAId, "contacts", { sort: "name" });
		await views.save(userAId, "contacts", { sort: "email", dir: "asc" });

		expect(await views.get(userAId, "contacts")).toEqual({
			sort: "email",
			dir: "asc",
		});

		const rows = await db.userView.findMany({
			where: { userId: userAId, tableId: "contacts" },
		});
		expect(rows).toHaveLength(1);
	});

	it("strips unknown keys before storing", async () => {
		const raw = { sort: "updatedAt", evil: "dropTable" } as unknown;
		const saved = await views.save(
			userAId,
			"projects",
			raw as Parameters<typeof views.save>[2],
		);

		expect(saved).toEqual({ sort: "updatedAt" });
		expect("evil" in saved).toBe(false);
	});

	it("rejects a state over the 4KB cap", async () => {
		await expectRejects(
			views.save(userAId, "invoices", {
				hiddenColumns: Array.from({ length: 2000 }, (_, i) => `column-${i}`),
			}),
			/too large/,
		);
	});
});

describe("reset", () => {
	it("deletes the saved row", async () => {
		await views.save(userAId, "estimates", { sort: "name" });
		expect(await views.get(userAId, "estimates")).not.toBeNull();

		await views.reset(userAId, "estimates");
		expect(await views.get(userAId, "estimates")).toBeNull();
	});

	it("is a no-op when nothing was saved", async () => {
		await views.reset(userAId, "contracts");
		expect(await views.get(userAId, "contracts")).toBeNull();
	});
});

describe("per-user isolation", () => {
	it("keeps two users' views for the same tableId separate", async () => {
		await views.save(userAId, "invoices", { sort: "dueDate" });
		await views.save(userBId, "invoices", { sort: "issuedAt" });

		expect(await views.get(userAId, "invoices")).toEqual({ sort: "dueDate" });
		expect(await views.get(userBId, "invoices")).toEqual({
			sort: "issuedAt",
		});
	});
});
