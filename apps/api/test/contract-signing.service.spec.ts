import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { ConflictException, NotFoundException } from "@nestjs/common";
import {
	contractSignInput,
	contractSigningTokenInput,
} from "../src/contracts/contracts.contracts";
import { ContractsService } from "../src/contracts/contracts.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplatesService } from "../src/templates/templates.service";

const CONTRACT_BODY_BLOCKS = [
	{ kind: "heading", text: "Roofing Services Agreement" },
	{ kind: "text", html: "Body for {{contact.full_name}}." },
];

const DRAWN_SIGNATURE =
	"data:image/png;base64,iVBORw0KGgpmYWtlLXJlc3Qtb2YtcG5nLWRhdGE=";
const CORRUPT_DRAWN_SIGNATURE =
	"data:image/png;base64,bm90LWEtcmVhbC1wbmctcGF5bG9hZC1hdC1hbGw=";

function fakeTemplates() {
	return {
		byPurpose: async () => ({
			id: "tmpl-body",
			subject: null,
			blocks: CONTRACT_BODY_BLOCKS,
		}),
	} as unknown as TemplatesService;
}

function fakeMergeContext() {
	return {
		resolve: async () => ({
			"business.name": "Acme Roofing",
			"contact.full_name": "Jane Doe",
		}),
	} as unknown as MergeContextService;
}

function fakeMailer(overrides: Partial<MailerService> = {}) {
	return {
		isConfigured: () => true,
		send: async () => ({ delivered: true }),
		...overrides,
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
	contact: { firstName: string; lastName: string | null } | null;
};

function baseContract(overrides: Partial<FakeContract> = {}): FakeContract {
	return {
		id: "contract1",
		number: 1,
		title: "Roof job contract",
		status: "SENT",
		body: CONTRACT_BODY_BLOCKS,
		dealId: null,
		contactId: "contact1",
		estimateId: null,
		invoiceId: null,
		createdById: "user1",
		sentAt: new Date("2026-01-01T00:00:00Z"),
		sentTo: "jane@example.com",
		signedAt: null,
		signerName: null,
		signatureKind: null,
		signatureData: null,
		signingToken: "valid-token",
		tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
		contact: { firstName: "Jane", lastName: "Doe" },
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
	ownerEmail: string | null = "owner@example.com",
) {
	let row = initial;

	const db = {
		contract: {
			findUnique: async ({
				where,
				select,
			}: {
				where: { id?: string; signingToken?: string };
				select?: Record<string, unknown>;
			}) => {
				if (where.id !== undefined && where.id !== row.id) return null;
				if (
					where.signingToken !== undefined &&
					where.signingToken !== row.signingToken
				) {
					return null;
				}
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
			updateMany: async ({
				where,
				data,
			}: {
				where: { id: string; status: string };
				data: Record<string, unknown>;
			}) => {
				if (where.id !== row.id || where.status !== row.status) {
					return { count: 0 };
				}
				row = { ...row, ...data } as FakeContract;
				return { count: 1 };
			},
		},
		member: {
			findFirst: async () =>
				ownerEmail ? { user: { email: ownerEmail } } : null,
		},
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
	} as unknown as Db;

	return { db, getRow: () => row };
}

function makeService(
	contract: FakeContract,
	mailer: MailerService = fakeMailer(),
	ownerEmail: string | null = "owner@example.com",
) {
	const { db, getRow } = fakeDb(contract, ownerEmail);
	const service = new ContractsService(
		db,
		fakeTemplates(),
		fakeMergeContext(),
		mailer,
	);
	return { service, getRow };
}

describe("ContractsService.bySigningToken", () => {
	it("throws NotFound for an unknown token", async () => {
		const { service } = makeService(baseContract());

		await expect(
			service.bySigningToken("unknown-token"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("never returns signingToken, signatureData, or record ids", async () => {
		const { service } = makeService(
			baseContract({ status: "SIGNED", signerName: "Jane Doe" }),
		);

		const result = await service.bySigningToken("valid-token");

		expect("signingToken" in result).toBe(false);
		expect("signatureData" in result).toBe(false);
		expect("id" in result).toBe(false);
		expect("contactId" in result).toBe(false);
		expect("dealId" in result).toBe(false);
		expect(result.title).toBe("Roof job contract");
		expect(result.businessName).toBe("Acme Roofing");
		expect(result.contactName).toBe("Jane Doe");
		expect(result.bodyHtml).toContain("Jane Doe");
	});

	it("marks a contract expired once tokenExpiresAt has passed", async () => {
		const { service } = makeService(
			baseContract({ tokenExpiresAt: new Date(Date.now() - 1000) }),
		);

		const result = await service.bySigningToken("valid-token");

		expect(result.expired).toBe(true);
	});

	it("marks a contract not expired while tokenExpiresAt is in the future", async () => {
		const { service } = makeService(baseContract());

		const result = await service.bySigningToken("valid-token");

		expect(result.expired).toBe(false);
	});

	it("throws Conflict instead of a 500 when the stored body is malformed", async () => {
		const { service } = makeService(baseContract({ body: { not: "blocks" } }));

		await expect(service.bySigningToken("valid-token")).rejects.toBeInstanceOf(
			ConflictException,
		);
	});
});

describe("contractSigningTokenInput", () => {
	it("rejects a token longer than the configured maximum", () => {
		const result = contractSigningTokenInput.safeParse({
			token: "a".repeat(129),
		});

		expect(result.success).toBe(false);
	});
});

describe("ContractsService.sign", () => {
	it("throws NotFound for an unknown token", async () => {
		const { service } = makeService(baseContract());

		await expect(
			service.sign({
				token: "unknown-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("throws a distinguishable Conflict once the token has expired", async () => {
		const { service } = makeService(
			baseContract({ tokenExpiresAt: new Date(Date.now() - 1000) }),
		);

		await expect(
			service.sign({
				token: "valid-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toMatchObject({
			constructor: ConflictException,
			message: expect.stringContaining("expired"),
		});
	});

	it("throws Conflict on a VOID contract, distinguishable from already-signed", async () => {
		const { service } = makeService(baseContract({ status: "VOID" }));

		await expect(
			service.sign({
				token: "valid-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toMatchObject({
			constructor: ConflictException,
			message: expect.not.stringContaining("already"),
		});
	});

	it("throws Conflict on a DRAFT contract", async () => {
		const { service } = makeService(baseContract({ status: "DRAFT" }));

		await expect(
			service.sign({
				token: "valid-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("throws a distinguishable Conflict when already signed", async () => {
		const { service } = makeService(
			baseContract({ status: "SIGNED", signerName: "Jane Doe" }),
		);

		await expect(
			service.sign({
				token: "valid-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toMatchObject({
			constructor: ConflictException,
			message: expect.stringContaining("already"),
		});
	});

	it("rejects a drawn signature that is not a PNG data URL", () => {
		const result = contractSignInput.safeParse({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "drawn",
			signatureData: "not-a-data-url",
		});

		expect(result.success).toBe(false);
	});

	it("rejects a drawn signature whose payload is not a real PNG", () => {
		const result = contractSignInput.safeParse({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "drawn",
			signatureData: CORRUPT_DRAWN_SIGNATURE,
		});

		expect(result.success).toBe(false);
	});

	it("rejects a token longer than the configured maximum", () => {
		const result = contractSignInput.safeParse({
			token: "a".repeat(129),
			signerName: "Jane Doe",
			signatureKind: "typed",
			signatureData: "Jane Doe",
		});

		expect(result.success).toBe(false);
	});

	it("rejects a drawn signature larger than the configured cap", () => {
		const oversized = `data:image/png;base64,${"a".repeat(600_000)}`;
		const result = contractSignInput.safeParse({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "drawn",
			signatureData: oversized,
		});

		expect(result.success).toBe(false);
	});

	it("rejects a typed signature longer than 120 characters", () => {
		const result = contractSignInput.safeParse({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "typed",
			signatureData: "a".repeat(121),
		});

		expect(result.success).toBe(false);
	});

	it("accepts a valid drawn signature", () => {
		const result = contractSignInput.safeParse({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "drawn",
			signatureData: DRAWN_SIGNATURE,
		});

		expect(result.success).toBe(true);
	});

	it("persists signerName, signatureKind, signatureData, signedAt and flips SIGNED", async () => {
		const { service, getRow } = makeService(baseContract());

		const result = await service.sign({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "drawn",
			signatureData: DRAWN_SIGNATURE,
		});

		expect(result.status).toBe("SIGNED");
		expect(getRow().status).toBe("SIGNED");
		expect(getRow().signerName).toBe("Jane Doe");
		expect(getRow().signatureKind).toBe("drawn");
		expect(getRow().signatureData).toBe(DRAWN_SIGNATURE);
		expect(getRow().signedAt).toBeInstanceOf(Date);
	});

	it("still signs when the mailer throws, and does not throw itself", async () => {
		const throwingMailer = fakeMailer({
			send: async () => {
				throw new Error("smtp down");
			},
		});
		const { service, getRow } = makeService(baseContract(), throwingMailer);

		const result = await service.sign({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "typed",
			signatureData: "Jane Doe",
		});

		expect(result.status).toBe("SIGNED");
		expect(getRow().status).toBe("SIGNED");
	});

	it("still signs when there is no workspace owner on record", async () => {
		const { service, getRow } = makeService(baseContract(), fakeMailer(), null);

		const result = await service.sign({
			token: "valid-token",
			signerName: "Jane Doe",
			signatureKind: "typed",
			signatureData: "Jane Doe",
		});

		expect(result.status).toBe("SIGNED");
		expect(getRow().status).toBe("SIGNED");
	});

	it("throws Conflict instead of double-writing when two signs race", async () => {
		const contract = baseContract();
		let updateCalled = false;

		const db = {
			contract: {
				findUnique: async () => contract,
				updateMany: async () => {
					updateCalled = true;
					return { count: 0 };
				},
			},
			member: {
				findFirst: async () => ({ user: { email: "owner@example.com" } }),
			},
			organization: {
				findUnique: async () => ({ name: "Acme Roofing" }),
			},
		} as unknown as Db;

		const service = new ContractsService(
			db,
			fakeTemplates(),
			fakeMergeContext(),
			fakeMailer(),
		);

		await expect(
			service.sign({
				token: "valid-token",
				signerName: "Jane Doe",
				signatureKind: "typed",
				signatureData: "Jane Doe",
			}),
		).rejects.toMatchObject({
			constructor: ConflictException,
			message: expect.stringContaining("already"),
		});

		expect(updateCalled).toBe(true);
	});
});
