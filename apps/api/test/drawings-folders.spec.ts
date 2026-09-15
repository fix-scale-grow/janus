import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { adminPrincipal } from "@crm/db/access-policy";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { DrawingsService } from "../src/drawings/drawings.service";

const suffix = process.env.TEST_RUN_ID ?? "drawings-folders-spec";
const userId = `user-${suffix}`;

const drawings = new DrawingsService(db);
const ADMIN = adminPrincipal("test");

async function clean() {
	await db.drawing.deleteMany({ where: { title: { contains: suffix } } });
	await db.drawingFolder.deleteMany({ where: { name: { contains: suffix } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();
	await db.user.create({
		data: {
			id: userId,
			name: `Folders ${suffix}`,
			email: `${suffix}-folders@example.com`,
			emailVerified: true,
		},
	});
});

afterAll(async () => {
	await clean();
});

describe("drawing folders", () => {
	it("creates, lists with counts, filters, moves, renames and deletes", async () => {
		const folder = await drawings.createFolder({ name: `Roofs ${suffix}` });
		expect(folder.name).toBe(`Roofs ${suffix}`);

		const drawing = await drawings.create(
			{ title: `Plan ${suffix}`, background: "WHITEBOARD" },
			userId,
			ADMIN,
		);
		const loose = await drawings.create(
			{ title: `Loose ${suffix}`, background: "WHITEBOARD" },
			userId,
			ADMIN,
		);

		const moved = await drawings.move(
			{
				id: drawing.id,
				folderId: folder.id,
			},
			ADMIN,
		);
		expect(moved.folderId).toBe(folder.id);

		const folders = await drawings.folders(ADMIN);
		const listed = folders.find((row) => row.id === folder.id);
		expect(listed?.drawingCount).toBe(1);

		const filtered = await drawings.list(
			{
				q: "",
				sort: "",
				dir: "asc",
				page: 1,
				pageSize: 50,
				attachment: "all",
				folderId: folder.id,
			},
			ADMIN,
		);
		expect(filtered.rows.map((row) => row.id)).toEqual([drawing.id]);
		expect(filtered.rows[0]?.folderId).toBe(folder.id);

		const unfiltered = await drawings.list(
			{
				q: suffix,
				sort: "",
				dir: "asc",
				page: 1,
				pageSize: 50,
				attachment: "all",
			},
			ADMIN,
		);
		expect(unfiltered.rows.map((row) => row.id).sort()).toEqual(
			[drawing.id, loose.id].sort(),
		);

		const renamed = await drawings.renameFolder({
			id: folder.id,
			name: `Renamed ${suffix}`,
		});
		expect(renamed.name).toBe(`Renamed ${suffix}`);

		const removed = await drawings.move(
			{ id: drawing.id, folderId: null },
			ADMIN,
		);
		expect(removed.folderId).toBeNull();

		await drawings.move({ id: drawing.id, folderId: folder.id }, ADMIN);
		await drawings.deleteFolder(folder.id);

		const survivor = await db.drawing.findUniqueOrThrow({
			where: { id: drawing.id },
			select: { folderId: true },
		});
		expect(survivor.folderId).toBeNull();
	});

	it("refuses a duplicate folder name", async () => {
		const name = `Dupes ${suffix}`;
		const first = await drawings.createFolder({ name });
		try {
			await drawings.createFolder({ name });
			expect.unreachable("duplicate create must throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictException);
		}
		await drawings.deleteFolder(first.id);
	});

	it("404s on a missing folder", async () => {
		try {
			await drawings.deleteFolder("missing-folder-id");
			expect.unreachable("missing delete must throw");
		} catch (error) {
			expect(error).toBeInstanceOf(NotFoundException);
		}
	});
});
