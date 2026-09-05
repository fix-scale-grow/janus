import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MailerService } from "../src/mailer/mailer.service";

const dirs: string[] = [];

async function tempOutboxDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "mail-outbox-"));
	dirs.push(dir);
	return dir;
}

afterEach(async () => {
	while (dirs.length > 0) {
		const dir = dirs.pop();
		if (dir) await rm(dir, { recursive: true, force: true });
	}
});

describe("MailerService file transport", () => {
	it("reports configured with zero SMTP vars", async () => {
		const outboxDir = await tempOutboxDir();
		const mailer = new MailerService({
			transport: "file",
			outboxDir,
			from: "Janus <estimates@example.com>",
		});

		expect(mailer.isConfigured()).toBe(true);
	});

	it("reports unconfigured with no transport", () => {
		const mailer = new MailerService({ transport: null });
		expect(mailer.isConfigured()).toBe(false);
	});

	it("writes the envelope and attachment bytes intact", async () => {
		const outboxDir = await tempOutboxDir();
		const mailer = new MailerService({
			transport: "file",
			outboxDir,
			from: "Janus <estimates@example.com>",
		});

		const content = Buffer.from("%PDF-1.4 fake estimate bytes");

		const result = await mailer.send({
			to: "customer@example.com",
			subject: "Your Estimate #42",
			text: "See attached.",
			attachments: [
				{ filename: "estimate.pdf", content, contentType: "application/pdf" },
			],
		});

		expect(result.delivered).toBe(true);

		const entries = await readdir(outboxDir);
		expect(entries).toHaveLength(1);

		const sendDir = join(outboxDir, entries[0] ?? "");
		expect(entries[0]).toContain("your-estimate-42");

		const envelopeRaw = await readFile(join(sendDir, "envelope.json"), "utf8");
		const envelope = JSON.parse(envelopeRaw) as {
			to: string;
			subject: string;
			text: string;
			attachments: { filename: string; bytes: number }[];
		};

		expect(envelope.to).toBe("customer@example.com");
		expect(envelope.subject).toBe("Your Estimate #42");
		expect(envelope.attachments).toEqual([
			{ filename: "estimate.pdf", bytes: content.byteLength },
		]);

		const writtenBytes = await readFile(join(sendDir, "estimate.pdf"));
		expect(writtenBytes.equals(content)).toBe(true);
	});

	it("sanitizes a path-traversal filename to stay inside the per-send dir", async () => {
		const outboxDir = await tempOutboxDir();
		const mailer = new MailerService({
			transport: "file",
			outboxDir,
			from: "Janus <estimates@example.com>",
		});

		const content = Buffer.from("evil bytes");

		const result = await mailer.send({
			to: "customer@example.com",
			subject: "Escape test",
			text: "See attached.",
			attachments: [{ filename: "../../escape.txt", content }],
		});

		expect(result.delivered).toBe(true);

		const entries = await readdir(outboxDir);
		expect(entries).toHaveLength(1);

		const sendDir = join(outboxDir, entries[0] ?? "");
		const sendDirEntries = await readdir(sendDir);

		expect(sendDirEntries.sort()).toEqual(["envelope.json", "escape.txt"]);

		const outsideEntries = await readdir(dirname(outboxDir));
		expect(outsideEntries).not.toContain("escape.txt");

		const writtenBytes = await readFile(join(sendDir, "escape.txt"));
		expect(writtenBytes.equals(content)).toBe(true);

		const envelopeRaw = await readFile(join(sendDir, "envelope.json"), "utf8");
		const envelope = JSON.parse(envelopeRaw) as {
			attachments: { filename: string; bytes: number }[];
		};
		expect(envelope.attachments).toEqual([
			{ filename: "escape.txt", bytes: content.byteLength },
		]);
	});
});
