import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { FieldsService } from "../src/fields/fields.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import { DEFAULT_TEMPLATES } from "../src/templates/templates.config";
import { TemplatesService } from "../src/templates/templates.service";

const fakeFields = {
	definitionsFor: async () => [],
} as unknown as FieldsService;

function fakeDb() {
	let row: Record<string, unknown> | null = null;
	let upsertCalls = 0;

	const db = {
		template: {
			upsert: async ({
				create,
				update,
			}: {
				create: Record<string, unknown>;
				update: Record<string, unknown>;
			}) => {
				upsertCalls += 1;
				if (!row) {
					row = {
						id: "tmpl1",
						createdAt: new Date("2026-01-01T00:00:00Z"),
						updatedAt: new Date("2026-01-01T00:00:00Z"),
						...create,
					};
				} else {
					row = { ...row, ...update, updatedAt: new Date() };
				}
				return row;
			},
		},
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
	} as unknown as Db;

	return { db, getRow: () => row, getUpsertCalls: () => upsertCalls };
}

function fakeMergeContext(resolved: Record<string, string> = {}) {
	let called = false;
	const service = {
		resolve: async () => {
			called = true;
			return resolved;
		},
	} as unknown as MergeContextService;
	return { service, wasCalled: () => called };
}

function fakeMailer(configured: boolean, delivered = true) {
	return {
		isConfigured: () => configured,
		send: async () => ({ delivered }),
	} as unknown as MailerService;
}

describe("TemplatesService.byPurpose", () => {
	it("creates the default row once and returns the same row on second call", async () => {
		const { db, getUpsertCalls } = fakeDb();
		const { service: mergeContext } = fakeMergeContext();
		const service = new TemplatesService(
			db,
			mergeContext,
			fakeMailer(true),
			fakeFields,
		);

		const first = await service.byPurpose({ purpose: "ESTIMATE_SEND" });
		const second = await service.byPurpose({ purpose: "ESTIMATE_SEND" });

		expect(first.id).toBe(second.id);
		expect(first.name).toBe(DEFAULT_TEMPLATES.ESTIMATE_SEND.name);
		expect(getUpsertCalls()).toBe(2);
	});
});

describe("TemplatesService.update", () => {
	it("rejects an invalid block tree", async () => {
		const { db } = fakeDb();
		const { service: mergeContext } = fakeMergeContext();
		const service = new TemplatesService(
			db,
			mergeContext,
			fakeMailer(true),
			fakeFields,
		);

		await expect(
			service.update(
				{
					purpose: "ESTIMATE_SEND",
					name: "Estimate email",
					blocks: [{ kind: "video", url: "x" }],
				},
				"user1",
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe("TemplatesService.preview", () => {
	it("uses sample merge data when no refs are given", async () => {
		const { db } = fakeDb();
		const { service: mergeContext, wasCalled } = fakeMergeContext();
		const service = new TemplatesService(
			db,
			mergeContext,
			fakeMailer(true),
			fakeFields,
		);

		const result = await service.preview({ purpose: "ESTIMATE_SEND" });

		expect(wasCalled()).toBe(false);
		expect(result.subject).toContain("Fix Scale Grow Roofing");
		expect(result.html).toContain("Jane");
	});

	it("resolves real merge data when a ref is given", async () => {
		const { db } = fakeDb();
		const { service: mergeContext, wasCalled } = fakeMergeContext({
			"business.name": "Real Co",
			"contact.first_name": "Bob",
			"estimate.title": "Roof job",
			"estimate.total": "$1.00",
		});
		const service = new TemplatesService(
			db,
			mergeContext,
			fakeMailer(true),
			fakeFields,
		);

		const result = await service.preview({
			purpose: "ESTIMATE_SEND",
			contactId: "c1",
		});

		expect(wasCalled()).toBe(true);
		expect(result.subject).toContain("Real Co");
	});
});

describe("TemplatesService.sendTest", () => {
	it("throws when mailer is unconfigured", async () => {
		const { db } = fakeDb();
		const { service: mergeContext } = fakeMergeContext();
		const service = new TemplatesService(
			db,
			mergeContext,
			fakeMailer(false),
			fakeFields,
		);

		await expect(
			service.sendTest({ purpose: "ESTIMATE_SEND", to: "jane@example.com" }),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("sends with the sample context and a [Test] subject prefix", async () => {
		const { db } = fakeDb();
		const { service: mergeContext } = fakeMergeContext();
		let sentSubject = "";
		const mailer = {
			isConfigured: () => true,
			send: async (input: { subject: string }) => {
				sentSubject = input.subject;
				return { delivered: true };
			},
		} as unknown as MailerService;
		const service = new TemplatesService(db, mergeContext, mailer, fakeFields);

		await service.sendTest({
			purpose: "ESTIMATE_SEND",
			to: "jane@example.com",
		});

		expect(sentSubject.startsWith("[Test] ")).toBe(true);
		expect(sentSubject).toContain("Fix Scale Grow Roofing");
	});
});
