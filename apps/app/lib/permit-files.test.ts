import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COST_ID_PATTERN } from "./cost-receipts";
import {
	contentTypeFor,
	PERMIT_FILE_TYPES,
	PERMIT_FILES,
	readLockerFile,
	readPermitFile,
	removeLockerFile,
	removePermitFile,
	saveLockerFile,
	savePermitFile,
} from "./permit-files";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "permit-files-"));
	process.env.PERMITS_DATA_DIR = dir;
});

afterEach(async () => {
	delete process.env.PERMITS_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe("PERMIT_FILES", () => {
	it("defaults to data/permits/locker and data/permits/documents", () => {
		expect(PERMIT_FILES.lockerDirName).toBe(join("data", "permits", "locker"));
		expect(PERMIT_FILES.documentDirName).toBe(
			join("data", "permits", "documents"),
		);
	});
});

describe("PERMIT_FILE_TYPES", () => {
	it("maps every accepted content type to its extension", () => {
		expect(PERMIT_FILE_TYPES["image/png"]).toBe("png");
		expect(PERMIT_FILE_TYPES["image/jpeg"]).toBe("jpg");
		expect(PERMIT_FILE_TYPES["image/webp"]).toBe("webp");
		expect(PERMIT_FILE_TYPES["application/pdf"]).toBe("pdf");
	});

	it("has no entry for an unsupported content type", () => {
		expect(PERMIT_FILE_TYPES["text/plain"]).toBeUndefined();
	});
});

describe("contentTypeFor", () => {
	it("resolves the content type from the file extension", () => {
		expect(contentTypeFor("abc.png")).toBe("image/png");
		expect(contentTypeFor("abc.jpg")).toBe("image/jpeg");
		expect(contentTypeFor("abc.webp")).toBe("image/webp");
		expect(contentTypeFor("abc.pdf")).toBe("application/pdf");
	});

	it("falls back to octet-stream for an unknown extension", () => {
		expect(contentTypeFor("abc.exe")).toBe("application/octet-stream");
	});
});

describe("COST_ID_PATTERN", () => {
	it("is reused rather than redefined", () => {
		expect(COST_ID_PATTERN.test("cabc123def456ghi789x")).toBe(true);
		expect(COST_ID_PATTERN.test("short")).toBe(false);
	});
});

describe("locker file storage", () => {
	it("saves and reads back a locker file under PERMITS_DATA_DIR/locker", async () => {
		const bytes = Buffer.from("fake-locker-bytes");

		const fileName = await saveLockerFile(
			"cabc123def456ghi789locker",
			"pdf",
			bytes,
		);
		expect(fileName).toBe("cabc123def456ghi789locker.pdf");

		const onDisk = await readdir(join(dir, "locker"));
		expect(onDisk).toEqual(["cabc123def456ghi789locker.pdf"]);

		const read = await readLockerFile(fileName as string);
		expect(read?.equals(bytes)).toBe(true);
	});

	it("returns null reading a locker file that does not exist", async () => {
		expect(await readLockerFile("missing.pdf")).toBeNull();
	});

	it("removing a locker file that does not exist does not throw", async () => {
		await removeLockerFile("missing.pdf");
	});

	it("removes a saved locker file", async () => {
		const fileName = await saveLockerFile(
			"cabc123def456ghi789locker",
			"png",
			Buffer.from("bytes"),
		);
		await removeLockerFile(fileName as string);
		expect(await readLockerFile(fileName as string)).toBeNull();
	});
});

describe("permit document file storage", () => {
	it("saves and reads back a permit document file under PERMITS_DATA_DIR/documents", async () => {
		const bytes = Buffer.from("fake-document-bytes");

		const fileName = await savePermitFile(
			"cabc123def456ghi789docmt",
			"jpg",
			bytes,
		);
		expect(fileName).toBe("cabc123def456ghi789docmt.jpg");

		const onDisk = await readdir(join(dir, "documents"));
		expect(onDisk).toEqual(["cabc123def456ghi789docmt.jpg"]);

		const read = await readPermitFile(fileName as string);
		expect(read?.equals(bytes)).toBe(true);
	});

	it("returns null reading a permit document that does not exist", async () => {
		expect(await readPermitFile("missing.jpg")).toBeNull();
	});

	it("removes a saved permit document file", async () => {
		const fileName = await savePermitFile(
			"cabc123def456ghi789docmt",
			"webp",
			Buffer.from("bytes"),
		);
		await removePermitFile(fileName as string);
		expect(await readPermitFile(fileName as string)).toBeNull();
	});
});
