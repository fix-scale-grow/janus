export type ApprovalRow = {
	label: string;
	value: string;
};

export type ApprovalSection = {
	title?: string;
	rows: ApprovalRow[];
};

export type ApprovalCopy = {
	title: string;
	render: (input: Record<string, unknown> | null) => ApprovalSection[];
	outcome?: (output: Record<string, unknown> | null) => string | null;
};

const FLATTEN_LIMITS = {
	maxDepth: 4,
	maxRows: 40,
	maxStringLength: 500,
} as const;

const EMPTY_VALUE = "—";
const TRUNCATION_LABEL = "…";

type ProposedDrawingTag = {
	shapeLabel: string;
	serviceName: string;
	reason: string;
};

function isProposedDrawingTag(value: unknown): value is ProposedDrawingTag {
	if (value === null || typeof value !== "object") return false;
	const tag = value as Record<string, unknown>;
	return (
		typeof tag.shapeLabel === "string" &&
		typeof tag.serviceName === "string" &&
		typeof tag.reason === "string"
	);
}

function proposedDrawingTags(
	input: Record<string, unknown> | null,
): ProposedDrawingTag[] {
	const tags = input?.tags;
	return Array.isArray(tags) ? tags.filter(isProposedDrawingTag) : [];
}

const SOURCE_LABEL: Record<string, string> = {
	missing: "Missing item",
	note: "From a drawing note",
	chat: "Asked in chat",
};

type ProposedEstimateLine = {
	name: string;
	unit: string;
	quantity: number;
	unitPriceCents?: number;
	serviceName?: string;
	reason: string;
	source: string;
};

function isProposedEstimateLine(value: unknown): value is ProposedEstimateLine {
	if (value === null || typeof value !== "object") return false;
	const line = value as Record<string, unknown>;
	return (
		typeof line.name === "string" &&
		typeof line.unit === "string" &&
		typeof line.quantity === "number" &&
		(line.unitPriceCents === undefined ||
			typeof line.unitPriceCents === "number") &&
		(line.serviceName === undefined || typeof line.serviceName === "string") &&
		typeof line.reason === "string" &&
		typeof line.source === "string"
	);
}

function formatDollars(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

function proposedEstimateLines(
	input: Record<string, unknown> | null,
): ProposedEstimateLine[] {
	const lines = input?.lines;
	return Array.isArray(lines) ? lines.filter(isProposedEstimateLine) : [];
}

type ServiceModifierOption = { name: string; factor: number };

type ServiceModifier = { label: string; options: ServiceModifierOption[] };

type ServiceFieldValues = {
	name?: string;
	unitPriceCents?: number;
	priceGoodCents?: number | null;
	priceBestCents?: number | null;
	modifier?: ServiceModifier | null;
};

type UpdateServiceInput = {
	current: Required<ServiceFieldValues>;
	changes: ServiceFieldValues;
};

function isServiceModifier(value: unknown): value is ServiceModifier {
	if (value === null || typeof value !== "object") return false;
	const modifier = value as Record<string, unknown>;
	return typeof modifier.label === "string" && Array.isArray(modifier.options);
}

function isUpdateServiceInput(
	value: Record<string, unknown> | null,
): value is UpdateServiceInput & Record<string, unknown> {
	if (value === null) return false;
	const current = value.current;
	const changes = value.changes;
	return (
		current !== null &&
		typeof current === "object" &&
		changes !== null &&
		typeof changes === "object"
	);
}

const SERVICE_FIELD_LABEL: Record<keyof ServiceFieldValues, string> = {
	name: "Name",
	unitPriceCents: "Book price",
	priceGoodCents: "Good price",
	priceBestCents: "Best price",
	modifier: "Modifier",
};

function formatModifier(modifier: ServiceModifier | null | undefined): string {
	if (!modifier) return EMPTY_VALUE;
	const options = modifier.options
		.map((option) => `${option.name} ×${option.factor}`)
		.join(", ");
	return `${modifier.label}: ${options}`;
}

function formatServiceValue(
	field: keyof ServiceFieldValues,
	value: unknown,
): string {
	if (field === "name") return typeof value === "string" ? value : EMPTY_VALUE;
	if (field === "modifier") {
		return isServiceModifier(value) || value === null
			? formatModifier(value as ServiceModifier | null)
			: EMPTY_VALUE;
	}
	return typeof value === "number" ? formatDollars(value) : EMPTY_VALUE;
}

const SERVICE_FIELD_ORDER: (keyof ServiceFieldValues)[] = [
	"name",
	"unitPriceCents",
	"priceGoodCents",
	"priceBestCents",
	"modifier",
];

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

type AppliedOutput = { applied: true } | { applied: false; reason: string };

function isAppliedOutput(value: unknown): value is AppliedOutput {
	if (value === null || typeof value !== "object") return false;
	const output = value as Record<string, unknown>;
	if (output.applied === true) return true;
	if (output.applied === false) return typeof output.reason === "string";
	return false;
}

type DrawingTagsOutput = AppliedOutput & { matched?: string[] };

function isDrawingTagsOutput(value: unknown): value is DrawingTagsOutput {
	if (!isAppliedOutput(value)) return false;
	if (!value.applied) return true;
	return Array.isArray((value as Record<string, unknown>).matched);
}

function drawingTagsOutcome(
	output: Record<string, unknown> | null,
): string | null {
	if (!isDrawingTagsOutput(output)) return null;
	if (!output.applied) return `Not applied — ${output.reason}`;
	return `Applied — ${plural((output.matched ?? []).length, "shape")} tagged`;
}

type EstimateLinesOutput = AppliedOutput & { lineItemIds?: string[] };

function isEstimateLinesOutput(value: unknown): value is EstimateLinesOutput {
	if (!isAppliedOutput(value)) return false;
	if (!value.applied) return true;
	return Array.isArray((value as Record<string, unknown>).lineItemIds);
}

function estimateLinesOutcome(
	output: Record<string, unknown> | null,
): string | null {
	if (!isEstimateLinesOutput(output)) return null;
	if (!output.applied) return `Not applied — ${output.reason}`;
	return `Applied — ${plural((output.lineItemIds ?? []).length, "line")} added`;
}

type ServiceUpdateOutput = AppliedOutput & { diff?: unknown[] };

function isServiceUpdateOutput(value: unknown): value is ServiceUpdateOutput {
	if (!isAppliedOutput(value)) return false;
	if (!value.applied) return true;
	return Array.isArray((value as Record<string, unknown>).diff);
}

function serviceUpdateOutcome(
	output: Record<string, unknown> | null,
): string | null {
	if (!isServiceUpdateOutput(output)) return null;
	if (!output.applied) return `Not applied — ${output.reason}`;
	return `Applied — ${plural((output.diff ?? []).length, "field")} updated`;
}

function genericOutcome(output: Record<string, unknown> | null): string | null {
	if (output === null) return null;
	if (output.applied === false) {
		return typeof output.reason === "string"
			? `Not applied — ${output.reason}`
			: "Not applied";
	}
	if (output.applied === true || output.written === true) return "Applied";
	if (output.stored === false || output.written === false) {
		return typeof output.reason === "string"
			? `Not applied — ${output.reason}`
			: "Not applied";
	}
	return null;
}

export const APPROVAL_COPY: Record<string, ApprovalCopy> = {
	update_service: {
		title: "Approve service update",
		render: (input) => {
			if (!isUpdateServiceInput(input)) return [{ rows: [] }];
			const { current, changes } = input;

			const rows = SERVICE_FIELD_ORDER.filter(
				(field) => changes[field] !== undefined,
			).map((field) => ({
				label: SERVICE_FIELD_LABEL[field],
				value: `${formatServiceValue(field, current[field])} → ${formatServiceValue(field, changes[field])}`,
			}));

			return [{ title: truncateText(current.name), rows }];
		},
		outcome: serviceUpdateOutcome,
	},

	propose_drawing_tags: {
		title: "Approve drawing tags",
		render: (input) => {
			const tags = proposedDrawingTags(input);
			if (tags.length === 0) return [{ rows: [] }];

			return tags.map((tag) => ({
				title: truncateText(tag.shapeLabel),
				rows: [
					{ label: "Service", value: truncateText(tag.serviceName) },
					{ label: "Why", value: truncateText(tag.reason) },
				],
			}));
		},
		outcome: drawingTagsOutcome,
	},

	propose_estimate_lines: {
		title: "Approve estimate line items",
		render: (input) => {
			const lines = proposedEstimateLines(input);
			if (lines.length === 0) return [{ rows: [] }];

			return lines.map((line) => ({
				title: truncateText(line.name),
				rows: [
					{
						label: "Quantity",
						value:
							line.unitPriceCents === undefined
								? `${line.quantity} ${humanise(line.unit)}`
								: `${line.quantity} ${humanise(line.unit)} × ${formatDollars(line.unitPriceCents)}`,
					},
					...(line.serviceName
						? [{ label: "Matches", value: truncateText(line.serviceName) }]
						: []),
					{
						label: "Source",
						value: SOURCE_LABEL[line.source] ?? humanise(line.source),
					},
					{ label: "Why", value: truncateText(line.reason) },
				],
			}));
		},
		outcome: estimateLinesOutcome,
	},
};

export type CacheInvalidationEntry =
	| { kind: "drawing"; id: string }
	| { kind: "estimate"; id: string }
	| { kind: "service"; id: string };

function stringField(
	input: Record<string, unknown> | null,
	key: string,
): string | undefined {
	const value = input?.[key];
	return typeof value === "string" ? value : undefined;
}

const APPROVAL_INVALIDATION: Record<
	string,
	(
		input: Record<string, unknown> | null,
		recordId: string,
	) => CacheInvalidationEntry[]
> = {
	propose_drawing_tags: (input, recordId) => [
		{ kind: "drawing", id: stringField(input, "drawingId") ?? recordId },
	],
	propose_estimate_lines: (input) => {
		const id = stringField(input, "estimateId");
		return id ? [{ kind: "estimate", id }] : [];
	},
	update_service: (input) => {
		const id = stringField(input, "serviceId");
		return id ? [{ kind: "service", id }] : [];
	},
};

export function invalidationFor(
	toolName: string,
	input: Record<string, unknown> | null,
	recordId: string,
): CacheInvalidationEntry[] {
	return APPROVAL_INVALIDATION[toolName]?.(input, recordId) ?? [];
}

export function approvalCopyFor(toolName: string): ApprovalCopy {
	return APPROVAL_COPY[toolName] ?? genericApprovalCopy(toolName);
}

function genericApprovalCopy(toolName: string): ApprovalCopy {
	return {
		title: `Approve ${humanise(toolName)}`,
		render: (input) => [{ rows: capRows(flattenRows(input)) }],
		outcome: genericOutcome,
	};
}

function capRows(rows: ApprovalRow[]): ApprovalRow[] {
	if (rows.length <= FLATTEN_LIMITS.maxRows) return rows;

	const kept = rows.slice(0, FLATTEN_LIMITS.maxRows - 1);
	return [
		...kept,
		{
			label: TRUNCATION_LABEL,
			value: `${rows.length - kept.length} more not shown`,
		},
	];
}

function flattenRows(value: unknown, prefix = "", depth = 0): ApprovalRow[] {
	if (value === null || value === undefined) {
		return prefix ? [{ label: prefix, value: EMPTY_VALUE }] : [];
	}

	if (depth >= FLATTEN_LIMITS.maxDepth) {
		return [{ label: prefix || "Value", value: describeValue(value) }];
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return [{ label: prefix || "Value", value: EMPTY_VALUE }];
		}
		if (value.every(isPrimitive)) {
			return [
				{
					label: prefix || "Value",
					value: truncateText(value.map(primitiveText).join(", ")),
				},
			];
		}
		return value.flatMap((entry, index) =>
			flattenRows(
				entry,
				prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`,
				depth + 1,
			),
		);
	}

	if (typeof value === "object") {
		if (!isPlainObject(value)) {
			return [{ label: prefix || "Value", value: safeObjectText(value) }];
		}

		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) {
			return prefix ? [{ label: prefix, value: EMPTY_VALUE }] : [];
		}
		return entries.flatMap(([key, entry]) =>
			flattenRows(
				entry,
				prefix ? `${prefix} — ${humanise(key)}` : humanise(key),
				depth + 1,
			),
		);
	}

	return [{ label: prefix || "Value", value: primitiveText(value) }];
}

function describeValue(value: unknown): string {
	if (Array.isArray(value)) return `[${value.length} items]`;

	if (value !== null && typeof value === "object") {
		return isPlainObject(value)
			? `{${Object.keys(value).length} fields}`
			: safeObjectText(value);
	}

	return primitiveText(value);
}

function isPlainObject(value: object): boolean {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function safeObjectText(value: object): string {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? "Invalid date" : value.toISOString();
	}

	try {
		const text = String(value);
		return text && text !== "[object Object]" ? truncateText(text) : "[object]";
	} catch {
		return "[object]";
	}
}

function isPrimitive(value: unknown): value is string | number | boolean {
	return (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

function primitiveText(value: unknown): string {
	if (typeof value === "string") return truncateText(value);
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return EMPTY_VALUE;
}

function truncateText(text: string): string {
	return text.length > FLATTEN_LIMITS.maxStringLength
		? `${text.slice(0, FLATTEN_LIMITS.maxStringLength)}…`
		: text;
}

function humanise(name: string): string {
	const words = name
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
