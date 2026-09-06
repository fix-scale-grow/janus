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
};

export const APPROVAL_COPY: Record<string, ApprovalCopy> = {};

const FLATTEN_LIMITS = {
	maxDepth: 4,
	maxRows: 40,
	maxStringLength: 500,
} as const;

const EMPTY_VALUE = "—";
const TRUNCATION_LABEL = "…";

export function approvalCopyFor(toolName: string): ApprovalCopy {
	return APPROVAL_COPY[toolName] ?? genericApprovalCopy(toolName);
}

function genericApprovalCopy(toolName: string): ApprovalCopy {
	return {
		title: `Approve ${humanise(toolName)}`,
		render: (input) => [{ rows: capRows(flattenRows(input)) }],
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
