import type { FieldEntity } from "./fields-entity";

export const STANDARD_FIELDS: Record<FieldEntity, readonly string[]> = {
	CONTACT: [
		"First name",
		"Last name",
		"Title",
		"Email",
		"Phone",
		"Company",
		"Owner",
	],
	DEAL: ["Name", "Amount", "Currency", "Close date", "Owner", "Stage"],
};
