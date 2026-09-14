import { db, type Prisma as PrismaNamespace } from "@crm/db";
import { parseWorksheetAnswers, parseWorksheetTemplate } from "@crm/db/permits";

export type FillWorksheetResult =
	| {
			found: true;
			filled: string[];
			skipped: { key: string; reason: string }[];
			permitId: string;
			dealId: string;
	  }
	| { found: false; reason: string };

export async function fillWorksheetAnswers(
	permitId: string,
	answers: Record<string, string>,
): Promise<FillWorksheetResult> {
	return db.$transaction(async (tx) => {
		const permit = await tx.permit.findUnique({
			where: { id: permitId },
			select: { dealId: true, playbookId: true, worksheetAnswers: true },
		});
		if (!permit) return { found: false, reason: "No such permit." };
		if (!permit.playbookId) {
			return {
				found: false,
				reason: "This permit has no playbook, so it has no worksheet template.",
			};
		}

		const playbook = await tx.permitPlaybook.findUniqueOrThrow({
			where: { id: permit.playbookId },
			select: { worksheetTemplate: true },
		});
		const template = parseWorksheetTemplate(playbook.worksheetTemplate);
		const templateKeys = new Set(template.map((field) => field.key));

		const current = parseWorksheetAnswers(permit.worksheetAnswers);
		const updated = { ...current };
		const filled: string[] = [];
		const skipped: { key: string; reason: string }[] = [];

		for (const [key, value] of Object.entries(answers)) {
			if (!templateKeys.has(key)) {
				skipped.push({
					key,
					reason: "Not a field on this permit's worksheet.",
				});
				continue;
			}
			if (current[key]?.state === "APPROVED") {
				skipped.push({ key, reason: "Already approved by a person." });
				continue;
			}
			updated[key] = {
				value,
				origin: "AI",
				state: "NEEDS_REVIEW",
				approvedById: null,
				approvedAt: null,
			};
			filled.push(key);
		}

		if (filled.length > 0) {
			await tx.permit.update({
				where: { id: permitId },
				data: {
					worksheetAnswers: updated as PrismaNamespace.InputJsonValue,
				},
			});
		}

		return {
			found: true,
			filled,
			skipped,
			permitId,
			dealId: permit.dealId,
		};
	});
}
