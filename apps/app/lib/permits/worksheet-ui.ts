export function deriveWorksheetFieldKey(label: string): string {
	const base = label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return (base || "field").slice(0, 60);
}

export function uniqueWorksheetFieldKey(
	label: string,
	existingKeys: string[],
): string {
	const base = deriveWorksheetFieldKey(label);
	if (!existingKeys.includes(base)) return base;

	let index = 2;
	let candidate = `${base}_${index}`.slice(0, 60);
	while (existingKeys.includes(candidate)) {
		index += 1;
		candidate = `${base}_${index}`.slice(0, 60);
	}
	return candidate;
}

export type WorksheetGateAnswer = {
	value: string;
	state: "NEEDS_REVIEW" | "APPROVED";
};

export type WorksheetGateField = {
	key: string;
	label: string;
	required: boolean;
};

function liveAnswers(
	fields: WorksheetGateField[],
	answers: Record<string, WorksheetGateAnswer>,
): WorksheetGateAnswer[] {
	const templateKeys = new Set(fields.map((field) => field.key));
	return Object.entries(answers)
		.filter(([key]) => templateKeys.has(key))
		.map(([, answer]) => answer);
}

export function worksheetBlockingReason(params: {
	fields: WorksheetGateField[];
	answers: Record<string, WorksheetGateAnswer>;
	disclaimerAccepted: boolean;
}): string | null {
	const { fields, answers, disclaimerAccepted } = params;

	const needsReview = liveAnswers(fields, answers).filter(
		(answer) => answer.value !== "" && answer.state === "NEEDS_REVIEW",
	).length;
	if (needsReview > 0) {
		const plural = needsReview !== 1;
		return `${needsReview} field${plural ? "s" : ""} ${plural ? "await" : "awaits"} review.`;
	}

	const missing = fields.find(
		(field) => field.required && (answers[field.key]?.value ?? "") === "",
	);
	if (missing) return `${missing.label} is required.`;

	if (!disclaimerAccepted) return "Accept the preparation disclaimer first.";

	return null;
}

export function isWorksheetHardBlocked(params: {
	fields: WorksheetGateField[];
	answers: Record<string, WorksheetGateAnswer>;
}): boolean {
	const { fields, answers } = params;

	const needsReview = liveAnswers(fields, answers).some(
		(answer) => answer.value !== "" && answer.state === "NEEDS_REVIEW",
	);
	if (needsReview) return true;

	return fields.some(
		(field) => field.required && (answers[field.key]?.value ?? "") === "",
	);
}
