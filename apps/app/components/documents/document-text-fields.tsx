"use client";

import { Field, FieldLabel } from "@crm/ui/components/field";
import { Textarea } from "@crm/ui/components/textarea";
import { useEffect, useState } from "react";

export type DocumentTextField = "introNote" | "scopeOfWork" | "terms";

const FIELDS: { key: DocumentTextField; label: string; hint: string }[] = [
	{
		key: "introNote",
		label: "Intro note",
		hint: "Prints above the line items.",
	},
	{
		key: "scopeOfWork",
		label: "Scope of work",
		hint: "Prints after the line items.",
	},
	{
		key: "terms",
		label: "Terms",
		hint: "Prints at the bottom in smaller type.",
	},
];

function TextField({
	label,
	hint,
	value,
	readOnly,
	onCommit,
}: {
	label: string;
	hint: string;
	value: string | null;
	readOnly: boolean;
	onCommit: (next: string | null) => void;
}) {
	const [draft, setDraft] = useState(value ?? "");
	useEffect(() => setDraft(value ?? ""), [value]);

	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<Textarea
				value={draft}
				readOnly={readOnly}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (readOnly) return;
					const next = draft.trim();
					if (next === (value ?? "")) return;
					onCommit(next || null);
				}}
				rows={3}
				placeholder={hint}
			/>
		</Field>
	);
}

export function DocumentTextFields({
	values,
	readOnly = false,
	onCommit,
}: {
	values: Record<DocumentTextField, string | null>;
	readOnly?: boolean;
	onCommit: (field: DocumentTextField, next: string | null) => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h2 className="font-semibold text-base">Document text</h2>
				<p className="text-muted-foreground text-sm">
					These sections print in the PDF for this document only.
				</p>
			</div>
			{FIELDS.map((field) => (
				<TextField
					key={field.key}
					label={field.label}
					hint={field.hint}
					value={values[field.key]}
					readOnly={readOnly}
					onCommit={(next) => onCommit(field.key, next)}
				/>
			))}
		</div>
	);
}
