import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { adminPrincipal } from "@crm/db/access-policy";
import { emptyScene } from "@crm/drawings";
import { ConflictException } from "@nestjs/common";
import { DrawingsService } from "../src/drawings/drawings.service";

const suffix = process.env.TEST_RUN_ID ?? "drawings-save-conflict-spec";
const userId = `user-${suffix}`;

const drawings = new DrawingsService(db);
const ADMIN = adminPrincipal("test");

async function clean() {
	await db.drawing.deleteMany({ where: { title: { contains: suffix } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();
	await db.user.create({
		data: {
			id: userId,
			name: `Conflict ${suffix}`,
			email: `${suffix}-conflict@example.com`,
			emailVerified: true,
		},
	});
});

afterAll(async () => {
	await clean();
});

describe("saveScene optimistic lock", () => {
	it("accepts a matching stamp and refuses a stale one", async () => {
		const drawing = await drawings.create(
			{ title: `Locked ${suffix}`, background: "WHITEBOARD" },
			userId,
			ADMIN,
		);

		const first = await drawings.saveScene(
			{
				id: drawing.id,
				scene: emptyScene(),
				expectedSceneUpdatedAt: null,
			},
			ADMIN,
		);
		expect(first.sceneUpdatedAt).toBeInstanceOf(Date);

		const second = await drawings.saveScene(
			{
				id: drawing.id,
				scene: emptyScene(),
				expectedSceneUpdatedAt: first.sceneUpdatedAt,
			},
			ADMIN,
		);
		expect(second.sceneUpdatedAt?.getTime()).toBeGreaterThan(
			first.sceneUpdatedAt?.getTime() ?? 0,
		);

		try {
			await drawings.saveScene(
				{
					id: drawing.id,
					scene: emptyScene(),
					expectedSceneUpdatedAt: first.sceneUpdatedAt,
				},
				ADMIN,
			);
			expect.unreachable("stale save must throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictException);
		}

		const unguarded = await drawings.saveScene(
			{
				id: drawing.id,
				scene: emptyScene(),
			},
			ADMIN,
		);
		expect(unguarded.sceneUpdatedAt).toBeInstanceOf(Date);
	});
});
