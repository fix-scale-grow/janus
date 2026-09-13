"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
import Close from "@carbon/icons-react/es/Close";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import { useState } from "react";
import { WORKSHEET_ANSWER_ORIGIN_LABEL } from "@/lib/permits/permit-status";
import type { RouterOutputs } from "@/lib/trpc/types";

type Permit = RouterOutputs["permits"]["byId"];
type WorksheetField = Permit["worksheetTemplate"][number];
type WorksheetAnswer = Permit["worksheetAnswers"][string];

export function WorksheetFieldRow({
	field,
	answer,
	onCommit,
	onApprove,
	onClear,
	pending,
}: {
	field: WorksheetField;
	answer: WorksheetAnswer | undefined;
	onCommit: (value: string) => void;
	onApprove: () => void;
	onClear: () => void;
	pending: boolean;
}) {
	const [draft, setDraft] = useState(answer?.value ?? "");

	const hasValue = (answer?.value ?? "") !== "";
	const needsReview = hasValue && answer?.state === "NEEDS_REVIEW";
	const approved = hasValue && answer?.state === "APPROVED";

	const commit = () => {
		if (draft !== (answer?.value ?? "")) onCommit(draft);
	};

	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-lg border p-2.5",
				needsReview && "ring-1 ring-warning/60",
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-sm font-medium">
					{field.label}
					{field.required ? <span className="text-destructive"> *</span> : null}
				</span>
				<div className="flex items-center gap-1.5">
					{hasValue ? (
						<Badge variant="outline">
							{WORKSHEET_ANSWER_ORIGIN_LABEL[answer?.origin ?? "HUMAN"]}
						</Badge>
					) : null}
					{needsReview ? (
						<Badge variant="outline">
							<Icon icon={WarningAlt} data-icon="inline-start" />
							Needs review
						</Badge>
					) : null}
					{approved ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<Icon icon={Checkmark} className="size-4 text-primary" />
									<span className="sr-only">Approved</span>
								</span>
							</TooltipTrigger>
							<TooltipContent>Approved</TooltipContent>
						</Tooltip>
					) : null}
					{hasValue ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending}
							onClick={onClear}
						>
							<Icon icon={Close} />
							<span className="sr-only">Clear {field.label}</span>
						</Button>
					) : null}
				</div>
			</div>

			<FieldControl
				field={field}
				draft={draft}
				pending={pending}
				onChange={setDraft}
				onCommit={commit}
				onImmediateCommit={onCommit}
			/>

			{needsReview ? (
				<div className="flex justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pending}
						onClick={onApprove}
					>
						Approve
					</Button>
				</div>
			) : null}
		</div>
	);
}

function FieldControl({
	field,
	draft,
	pending,
	onChange,
	onCommit,
	onImmediateCommit,
}: {
	field: WorksheetField;
	draft: string;
	pending: boolean;
	onChange: (value: string) => void;
	onCommit: () => void;
	onImmediateCommit: (value: string) => void;
}) {
	if (field.type === "CHECKBOX") {
		return (
			<Checkbox
				checked={draft === "true"}
				disabled={pending}
				onCheckedChange={(checked) => {
					const next = checked === true ? "true" : "";
					onChange(next);
					onImmediateCommit(next);
				}}
			/>
		);
	}

	if (field.type === "DATE") {
		return (
			<DatePicker
				value={draft || null}
				onChange={(next) => {
					onChange(next);
					onImmediateCommit(next);
				}}
			/>
		);
	}

	return (
		<Input
			type={field.type === "NUMBER" ? "number" : "text"}
			value={draft}
			disabled={pending}
			onChange={(event) => onChange(event.target.value)}
			onBlur={onCommit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					onCommit();
				}
			}}
		/>
	);
}
