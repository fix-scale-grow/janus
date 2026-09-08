"use client";

import type { FormFieldType } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { PREVIEW_NOTE, PREVIEW_TITLE } from "./forms-copy";

export type PreviewField = {
	id: string;
	type: FormFieldType;
	label: string;
	required: boolean;
	options: string[];
};

export type PreviewConfig = {
	name: string;
	intro: string;
	buttonLabel: string;
	fields: PreviewField[];
};

function PreviewInput({ field }: { field: PreviewField }) {
	if (field.type === "MESSAGE") {
		return <Textarea disabled rows={3} />;
	}

	if (field.type === "SELECT") {
		return (
			<Select disabled value="">
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select…" />
				</SelectTrigger>
				<SelectContent>
					{field.options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	const type =
		field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text";

	return <Input disabled type={type} />;
}

export function FormPreview({ config }: { config: PreviewConfig }) {
	return (
		<Card className="sticky top-4">
			<CardContent className="flex flex-col gap-4 pt-6">
				<div>
					<p className="font-medium text-muted-foreground text-xs">
						{PREVIEW_TITLE}
					</p>
					<p className="text-muted-foreground text-xs">{PREVIEW_NOTE}</p>
				</div>

				<div className="rounded-lg border bg-card p-4">
					<h2 className="font-semibold text-base">{config.name || "—"}</h2>
					{config.intro ? (
						<p className="mt-1 text-muted-foreground text-sm">{config.intro}</p>
					) : null}

					<div className="mt-4 flex flex-col gap-3">
						{config.fields.map((field) => (
							<Field key={field.id}>
								<FieldLabel>
									{field.label || "—"}
									{field.required ? " *" : ""}
								</FieldLabel>
								<PreviewInput field={field} />
							</Field>
						))}
					</div>

					<Button disabled className="mt-4 w-full">
						{config.buttonLabel || "Send"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
