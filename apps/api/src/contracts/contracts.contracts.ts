import { ContractStatus } from "@crm/db";
import { z } from "zod";
import { templateBlocksSchema } from "../templates/template-blocks";
import { listInput } from "../trpc/list-input";
import { CONTRACTS } from "./contracts.config";

const statusEnum = z.enum(
	Object.values(ContractStatus) as [ContractStatus, ...ContractStatus[]],
);

export const contractListInput = listInput.extend({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
	status: statusEnum.optional(),
});

export type ContractListInput = z.infer<typeof contractListInput>;

export const contractIdInput = z.object({ id: z.string().min(1) });

export type ContractIdInput = z.infer<typeof contractIdInput>;

export const contractCreateFromEstimateInput = z.object({
	estimateId: z.string().min(1),
});

export type ContractCreateFromEstimateInput = z.infer<
	typeof contractCreateFromEstimateInput
>;

export const contractCreateInput = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export type ContractCreateInput = z.infer<typeof contractCreateInput>;

export const contractUpdateFields = z.object({
	title: z
		.string()
		.trim()
		.min(1, "A contract needs a name.")
		.max(200)
		.optional(),
	body: templateBlocksSchema.optional(),
	invoiceId: z.string().min(1).nullable().optional(),
	contactId: z.string().min(1).nullable().optional(),
});

export type ContractUpdateFields = z.infer<typeof contractUpdateFields>;

export const contractUpdateInput = z.object({
	id: z.string().min(1),
	data: contractUpdateFields,
});

export type ContractUpdateInput = z.infer<typeof contractUpdateInput>;

export const contractSendInput = z.object({
	id: z.string().min(1),
	to: z.email("That is not an email address.").optional(),
	subject: z.string().trim().min(1).max(200).optional(),
	personalNote: z.string().trim().max(2000).optional(),
});

export type ContractSendInput = z.infer<typeof contractSendInput>;

export const contractSigningTokenInput = z.object({
	token: z.string().min(1),
});

export type ContractSigningTokenInput = z.infer<
	typeof contractSigningTokenInput
>;

const SIGNER_NAME_MAX_LENGTH = 120;
const TYPED_SIGNATURE_MAX_LENGTH = 120;

export const contractSignInput = z
	.object({
		token: z.string().min(1),
		signerName: z.string().trim().min(1).max(SIGNER_NAME_MAX_LENGTH),
		signatureKind: z.enum(["typed", "drawn"]),
		signatureData: z.string().min(1),
	})
	.superRefine((data, ctx) => {
		if (data.signatureKind === "drawn") {
			if (!data.signatureData.startsWith(CONTRACTS.signature.drawnPrefix)) {
				ctx.addIssue({
					code: "custom",
					path: ["signatureData"],
					message: "A drawn signature must be a PNG image.",
				});
			}
			if (data.signatureData.length > CONTRACTS.signature.drawnMaxChars) {
				ctx.addIssue({
					code: "custom",
					path: ["signatureData"],
					message: "The signature image is too large.",
				});
			}
			return;
		}

		if (data.signatureData.length > TYPED_SIGNATURE_MAX_LENGTH) {
			ctx.addIssue({
				code: "custom",
				path: ["signatureData"],
				message: "A typed signature must be 120 characters or fewer.",
			});
		}
	});

export type ContractSignInput = z.infer<typeof contractSignInput>;
