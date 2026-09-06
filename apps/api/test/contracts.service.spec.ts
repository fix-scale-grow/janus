import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ContractsService } from "../src/contracts/contracts.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplateBlock } from "../src/templates/template-blocks";
import type { TemplatesService } from "../src/templates/templates.service";

const CONTRACT_BODY_BLOCKS: TemplateBlock[] = [
	{ kind: "heading", text: "Roofing Services Agreement" },
	{ kind: "text", html: "Body for {{contact.full_name}}." },
];

const CONTRACT_SEND_BLOCKS: TemplateBlock[] = [
	{ kind: "heading", text: "Please sign" },
	{ kind: "text", html: "Sign here: {{signing_link}}, from {{sender.name}}" },
];

function fakeTemplates() {
	return {
		byPurpose: async ({ purpose }: { purpose: string }) => {
			if (purpose === "CONTRACT_BODY") {
				return {
					id: "tmpl-body",
					subject: null,
					blocks: CONTRACT_BODY_BLOCKS,
				};
			}
			return {
				id: "tmpl-send",
				subject: "Please sign: {{contract.title}}",
				blocks: CONTRACT_SEND_BLOCKS,
			};
		},
		mergeRegistry: async () =>
			new Map([
				["contract.title", "Contract title"],
				["contact.full_name", "Full name"],
				["signing_link", "Signing link"],
				["sender.name", "Sender name"],
			]),
	} as unknown as TemplatesService;
}

function fakeMergeContext() {
	return {
		resolve: async (refs: { senderName?: string }) => ({
			"contract.title": "A contract",
			signing_link: "https://app.example.com/sign/abc123",
			...(refs.senderName ? { "sender.name": refs.senderName } : {}),
		}),
	} as unknown as MergeContextService;
}

function fakeMailer(configured: boolean, delivered = true) {
	return {
		isConfigured: () => configured,
		send: async () => ({ delivered }),
	} as unknown as MailerService;
}

type FakeContract = {
	id: string;
	number: number;
	title: string;
	status: "DRAFT" | "SENT" | "SIGNED" | "VOID";
	body: unknown;
	dealId: string | null;
	contactId: string | null;
	estimateId: string | null;
	invoiceId: string | null;
	createdById: string;
	sentAt: Date | null;
	sentTo: string | null;
	signedAt: Date | null;
	signerName: string | null;
	signatureKind: string | null;
	signatureData: string | null;
	signingToken: string | null;
	tokenExpiresAt: Date | null;
	contact: { email: string | null } | null;
};

function baseContract(overrides: Partial<FakeContract> = {}): FakeContract {
	return {
		id: "contract1",
		number: 1,
		title: "Roof job contract",
		status: "DRAFT",
		body: CONTRACT_BODY_BLOCKS,
		dealId: null,
		contactId: "contact1",
		estimateId: null,
		invoiceId: null,
		createdById: "user1",
		sentAt: null,
		sentTo: null,
		signedAt: null,
		signerName: null,
		signatureKind: null,
		signatureData: null,
		signingToken: null,
		tokenExpiresAt: null,
		contact: { email: "jane@example.com" },
		...overrides,
	};
}

function applySelect<T extends Record<string, unknown>>(
	row: T,
	select?: Record<string, unknown>,
): Partial<T> {
	if (!select) return row;

	const result: Partial<T> = {};
	for (const key of Object.keys(select)) {
		if (key in row) result[key as keyof T] = row[key as keyof T];
	}
	return result;
}

function fakeDb(
	initial: FakeContract,
	listRows: Record<string, unknown>[] = [],
) {
	let row = initial;
	const estimates = new Map<
		string,
		{ title: string; dealId: string | null; contactId: string | null }
	>();

	const db = {
		estimate: {
			findUnique: async ({ where }: { where: { id: string } }) =>
				estimates.get(where.id) ?? null,
		},
		contract: {
			findUnique: async (args: { select?: Record<string, unknown> } = {}) =>
				applySelect(row, args.select),
			findMany: async () => listRows,
			count: async () => listRows.length,
			create: async ({
				data,
				select,
			}: {
				data: Record<string, unknown>;
				select?: Record<string, unknown>;
			}) => {
				row = { ...row, ...data } as FakeContract;
				return applySelect(row, select);
			},
			update: async ({
				data,
				select,
			}: {
				data: Record<string, unknown>;
				select?: Record<string, unknown>;
			}) => {
				row = { ...row, ...data } as FakeContract;
				return applySelect(row, select);
			},
			delete: async () => {
				return { id: row.id, title: row.title };
			},
		},
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
	} as unknown as Db;

	return {
		db,
		getRow: () => row,
		addEstimate: (
			id: string,
			estimate: {
				title: string;
				dealId: string | null;
				contactId: string | null;
			},
		) => estimates.set(id, estimate),
	};
}

const LIST_ROW_BASE = {
	id: "contract1",
	number: 1,
	title: "Roof job contract",
	status: "DRAFT",
	dealId: null,
	contactId: null,
	sentAt: null,
	signedAt: null,
	updatedAt: new Date("2026-02-01T00:00:00Z"),
	contact: null,
	estimate: null,
	invoice: null,
};

describe("ContractsService.list", () => {
	it("shows the invoice total when a contract has a linked invoice", async () => {
		const { db } = fakeDb(baseContract(), [
			{
				...LIST_ROW_BASE,
				estimate: {
					id: "est1",
					title: "Roof estimate",
					currency: "USD",
					selectedTier: "BETTER",
					lineItems: [
						{
							quantity: "2",
							priceGoodCents: 1000,
							priceBetterCents: 2000,
							priceBestCents: 3000,
						},
					],
				},
				invoice: {
					id: "inv1",
					number: 7,
					currency: "USD",
					lineItems: [
						{ quantity: "3", priceCents: 500 },
						{ quantity: "1", priceCents: 250 },
					],
				},
			},
		]);
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.list({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 20,
		});

		expect(result.rows[0]?.valueCents).toBe(1750);
		expect(result.rows[0]?.currency).toBe("USD");
	});

	it("shows the estimate's selected-tier total when there is only an estimate", async () => {
		const { db } = fakeDb(baseContract(), [
			{
				...LIST_ROW_BASE,
				estimate: {
					id: "est1",
					title: "Roof estimate",
					currency: "USD",
					selectedTier: "BEST",
					lineItems: [
						{
							quantity: "2",
							priceGoodCents: 1000,
							priceBetterCents: 2000,
							priceBestCents: 3000,
						},
					],
				},
				invoice: null,
			},
		]);
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.list({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 20,
		});

		expect(result.rows[0]?.valueCents).toBe(6000);
		expect(result.rows[0]?.currency).toBe("USD");
	});

	it("shows null when there is neither an invoice nor an estimate", async () => {
		const { db } = fakeDb(baseContract(), [{ ...LIST_ROW_BASE }]);
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.list({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 20,
		});

		expect(result.rows[0]?.valueCents).toBeNull();
		expect(result.rows[0]?.currency).toBeNull();
	});
});

describe("ContractsService.byId", () => {
	it("never returns signingToken or signatureData", async () => {
		const { db } = fakeDb(
			baseContract({
				status: "SENT",
				signingToken: "secret-token-value",
				signatureKind: "drawn",
				signatureData: "data:image/png;base64,abc123",
				signerName: "Jane Doe",
				signedAt: new Date("2026-02-01T00:00:00Z"),
			}),
		);
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.byId("contract1");

		expect("signingToken" in result).toBe(false);
		expect("signatureData" in result).toBe(false);
		expect(result.signerName).toBe("Jane Doe");
	});
});

describe("ContractsService.createFromEstimate", () => {
	it("snapshots the contract body and links deal/contact/estimate", async () => {
		const { db, addEstimate } = fakeDb(baseContract());
		addEstimate("est1", {
			title: "Roof estimate",
			dealId: "deal1",
			contactId: "contact1",
		});
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const created = await service.createFromEstimate(
			{ estimateId: "est1" },
			"user1",
		);

		expect(created.title).toBe("Roof estimate");
		expect(created.dealId).toBe("deal1");
		expect(created.contactId).toBe("contact1");
		expect(created.estimateId).toBe("est1");
		expect(created.body).toEqual(CONTRACT_BODY_BLOCKS);
	});
});

describe("ContractsService.send", () => {
	it("rejects when there is no contact email and no explicit to", async () => {
		const { db } = fakeDb(baseContract({ contact: { email: null } }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await expect(service.send({ id: "contract1" })).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it("flips DRAFT to SENT and stores a 43-char signing token", async () => {
		const { db, getRow } = fakeDb(baseContract());
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.send({ id: "contract1" }, "Alex Rivera");

		expect(result.status).toBe("SENT");
		expect(getRow().signingToken).toHaveLength(43);
		expect(getRow().sentTo).toBe("jane@example.com");
		expect("signingToken" in result).toBe(false);
		expect("signatureData" in result).toBe(false);
	});

	it("resolves the stock template's sender.name token from the threaded sender name", async () => {
		const { db, getRow } = fakeDb(baseContract());
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await expect(service.send({ id: "contract1" })).rejects.toBeInstanceOf(
			BadRequestException,
		);

		const result = await service.send({ id: "contract1" }, "Alex Rivera");
		expect(result.status).toBe("SENT");
		expect(getRow().status).toBe("SENT");
	});

	it("rotates the token on a resend while already SENT", async () => {
		const { db, getRow } = fakeDb(
			baseContract({ status: "SENT", signingToken: "old-token" }),
		);
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await service.send({ id: "contract1" }, "Alex Rivera");

		expect(getRow().signingToken).not.toBe("old-token");
		expect(getRow().signingToken).toHaveLength(43);
	});

	it("never flips status when delivery fails", async () => {
		const { db, getRow } = fakeDb(baseContract());
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true, false),
		);

		await expect(
			service.send({ id: "contract1" }, "Alex Rivera"),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(getRow().status).toBe("DRAFT");
	});
});

describe("ContractsService.update", () => {
	it("rejects with Conflict once status is SENT", async () => {
		const { db } = fakeDb(baseContract({ status: "SENT" }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await expect(
			service.update({ id: "contract1", data: { title: "New title" } }),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("allows linking invoiceId while SENT", async () => {
		const { db, getRow } = fakeDb(baseContract({ status: "SENT" }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await service.update({ id: "contract1", data: { invoiceId: "inv1" } });

		expect(getRow().invoiceId).toBe("inv1");
	});
});

describe("ContractsService.delete", () => {
	it("rejects with Conflict once status is SENT", async () => {
		const { db } = fakeDb(baseContract({ status: "SENT" }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await expect(service.delete("contract1")).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it("succeeds while status is DRAFT", async () => {
		const { db } = fakeDb(baseContract());
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		const result = await service.delete("contract1");
		expect(result.id).toBe("contract1");
	});
});

describe("ContractsService.void", () => {
	it("rejects once already VOID", async () => {
		const { db } = fakeDb(baseContract({ status: "VOID" }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await expect(service.void("contract1")).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it("moves a SENT contract to VOID", async () => {
		const { db, getRow } = fakeDb(baseContract({ status: "SENT" }));
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(true),
		);

		await service.void("contract1");
		expect(getRow().status).toBe("VOID");
	});
});

describe("ContractsService.mailerConfigured", () => {
	it("reflects the mailer's configuration state", () => {
		const { db } = fakeDb(baseContract());
		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(false),
		);

		expect(service.mailerConfigured()).toBe(false);
	});
});
