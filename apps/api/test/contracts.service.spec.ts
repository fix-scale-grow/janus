import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ContractsService } from "../src/contracts/contracts.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplatesService } from "../src/templates/templates.service";

const CONTRACT_BODY_BLOCKS = [
	{ kind: "heading", text: "Roofing Services Agreement" },
	{ kind: "text", html: "Body for {{contact.full_name}}." },
];

const CONTRACT_SEND_BLOCKS = [
	{ kind: "heading", text: "Please sign" },
	{ kind: "text", html: "Sign here: {{signing_link}}" },
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
	} as unknown as TemplatesService;
}

function fakeMergeContext() {
	return {
		resolve: async () => ({ "contract.title": "A contract" }),
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

function fakeDb(initial: FakeContract) {
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
			findUnique: async () => row,
			create: async ({ data }: { data: Record<string, unknown> }) => {
				row = { ...row, ...data } as FakeContract;
				return row;
			},
			update: async ({ data }: { data: Record<string, unknown> }) => {
				row = { ...row, ...data } as FakeContract;
				return row;
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

		const result = await service.send({ id: "contract1" });

		expect(result.status).toBe("SENT");
		expect(getRow().signingToken).toHaveLength(43);
		expect(getRow().sentTo).toBe("jane@example.com");
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

		await service.send({ id: "contract1" });

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

		await expect(service.send({ id: "contract1" })).rejects.toBeInstanceOf(
			BadRequestException,
		);
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
