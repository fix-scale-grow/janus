export type TakeoffShape = {
	scopeId: string;
	kind: string;
	label: string;
	service: string;
	hasQuantity: boolean;
};

export type BookService = {
	id: string;
	name: string;
};

export type ServicePattern = {
	key: string;
	label: string;
	regex: RegExp;
};

export const SERVICE_PATTERNS: readonly ServicePattern[] = [
	{ key: "disposal", label: "disposal", regex: /disposal|dump|haul/i },
	{ key: "underlayment", label: "underlayment", regex: /underlayment|felt/i },
	{ key: "permit", label: "permit", regex: /permit/i },
];

export type MissingServiceQuestion = {
	pattern: string;
	label: string;
	bookServices: string[];
};

export type TakeoffReviewFacts = {
	unassignedShapes: Array<{ scopeId: string; kind: string; label: string }>;
	taggedUnmeasuredShapes: Array<{
		scopeId: string;
		kind: string;
		label: string;
		service: string;
	}>;
	missingServiceQuestions: MissingServiceQuestion[];
};

function canonicalServiceName(name: string): string {
	return name.trim().toLowerCase();
}

export function reviewTakeoff(input: {
	shapes: TakeoffShape[];
	bookServices: BookService[];
	estimateServiceNames: string[];
	patterns?: readonly ServicePattern[];
}): TakeoffReviewFacts {
	const unassignedShapes = input.shapes
		.filter((shape) => shape.service === "unassigned" && shape.hasQuantity)
		.map(({ scopeId, kind, label }) => ({ scopeId, kind, label }));

	const taggedUnmeasuredShapes = input.shapes
		.filter((shape) => shape.service !== "unassigned" && !shape.hasQuantity)
		.map(({ scopeId, kind, label, service }) => ({
			scopeId,
			kind,
			label,
			service,
		}));

	const somethingIsPriced = input.shapes.some(
		(shape) => shape.service !== "unassigned",
	);

	const estimateNames = new Set(
		input.estimateServiceNames.map(canonicalServiceName),
	);

	const missingServiceQuestions: MissingServiceQuestion[] = [];

	if (somethingIsPriced) {
		for (const pattern of input.patterns ?? SERVICE_PATTERNS) {
			const matching = input.bookServices.filter((service) =>
				pattern.regex.test(service.name),
			);
			if (matching.length === 0) continue;

			const onEstimate = matching.some((service) =>
				estimateNames.has(canonicalServiceName(service.name)),
			);
			if (onEstimate) continue;

			missingServiceQuestions.push({
				pattern: pattern.key,
				label: pattern.label,
				bookServices: matching.map((service) => service.name),
			});
		}
	}

	return { unassignedShapes, taggedUnmeasuredShapes, missingServiceQuestions };
}
