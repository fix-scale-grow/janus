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

export function approvalCopyFor(toolName: string): ApprovalCopy {
	return APPROVAL_COPY[toolName] ?? genericApprovalCopy(toolName);
}

function genericApprovalCopy(toolName: string): ApprovalCopy {
	return {
		title: `Approve ${humanise(toolName)}`,
		render: (input) => [{ rows: flattenRows(input) }],
	};
}

function flattenRows(value: unknown, prefix = ""): ApprovalRow[] {
	if (value === null || value === undefined) {
		return prefix ? [{ label: prefix, value: EMPTY_VALUE }] : [];
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return [{ label: prefix || "Value", value: EMPTY_VALUE }];
		}
		if (value.every(isPrimitive)) {
			return [
				{
					label: prefix || "Value",
					value: value.map(primitiveText).join(", "),
				},
			];
		}
		return value.flatMap((entry, index) =>
			flattenRows(
				entry,
				prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`,
			),
		);
	}

	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) {
			return prefix ? [{ label: prefix, value: EMPTY_VALUE }] : [];
		}
		return entries.flatMap(([key, entry]) =>
			flattenRows(
				entry,
				prefix ? `${prefix} — ${humanise(key)}` : humanise(key),
			),
		);
	}

	return [{ label: prefix || "Value", value: primitiveText(value) }];
}

const EMPTY_VALUE = "—";

function isPrimitive(value: unknown): value is string | number | boolean {
	return (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

function primitiveText(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return EMPTY_VALUE;
}

function humanise(name: string): string {
	const words = name
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
