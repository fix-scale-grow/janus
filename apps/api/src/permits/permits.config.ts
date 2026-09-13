export const PERMITS = {
	playbook: { maxPrerequisites: 20, maxDocuments: 30, maxInspections: 20 },
	worksheet: { maxFields: 80 },
	list: { pageSize: 50 },
	permit: { maxFeeCents: 100_000_000 },
} as const;
