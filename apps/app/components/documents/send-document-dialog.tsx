"use client";

import Warning from "@carbon/icons-react/es/Warning";
import type { TemplatePurpose } from "@crm/db/enums";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export type SendDocumentMutation = {
	mutate: (input: {
		id: string;
		to: string;
		subject?: string;
		personalNote?: string;
	}) => void;
	isPending: boolean;
};

export type SendDocumentRefs = {
	contactId?: string;
	dealId?: string;
	estimateId?: string;
	invoiceId?: string;
};

export function SendDocumentDialog({
	documentId,
	entityLabel,
	purpose,
	refs,
	defaultTo,
	open,
	onOpenChange,
	mutation,
}: {
	documentId: string;
	entityLabel: string;
	purpose: TemplatePurpose;
	refs: SendDocumentRefs;
	defaultTo: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mutation: SendDocumentMutation;
}) {
	const trpc = useTRPC();
	const toId = useId();
	const subjectId = useId();
	const noteId = useId();

	const [to, setTo] = useState(defaultTo);
	const [subject, setSubject] = useState("");
	const [subjectDirty, setSubjectDirty] = useState(false);
	const [personalNote, setPersonalNote] = useState("");

	const preview = useQuery({
		...trpc.templates.preview.queryOptions({ purpose, ...refs }),
		enabled: open,
	});

	useEffect(() => {
		if (!open) return;
		setTo(defaultTo);
		setSubject("");
		setSubjectDirty(false);
		setPersonalNote("");
	}, [open, defaultTo]);

	useEffect(() => {
		if (subjectDirty || !preview.data) return;
		setSubject(preview.data.subject);
	}, [preview.data, subjectDirty]);

	const missing = preview.data?.missing ?? [];
	const hasUnknownMerge = missing.some((entry) => entry.reason === "unknown");

	const submit = () => {
		const trimmedTo = to.trim();
		const trimmedSubject = subject.trim();

		if (!trimmedTo) {
			toast.error(`Enter who this ${entityLabel} goes to.`);
			return;
		}
		if (subjectDirty && !trimmedSubject) {
			toast.error("Give the email a subject.");
			return;
		}

		mutation.mutate({
			id: documentId,
			to: trimmedTo,
			subject: subjectDirty ? trimmedSubject : undefined,
			personalNote: personalNote.trim() || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-(--container-page-wide)">
				<DialogHeader>
					<DialogTitle>Send {entityLabel}</DialogTitle>
					<DialogDescription>
						This emails the PDF as an attachment. Nothing sends until you press
						Send.
					</DialogDescription>
				</DialogHeader>
				{missing.length > 0 ? (
					<Alert variant="warning">
						<Icon icon={Warning} />
						<AlertTitle>
							{missing.length === 1
								? "One merge field needs a value"
								: `${missing.length} merge fields need a value`}
						</AlertTitle>
						<AlertDescription>
							<ul className="list-disc pl-4">
								{missing.map((entry) => (
									<li key={entry.token}>
										{entry.label}. Fill it on the contact or job, or remove it
										from the template.
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				) : null}
				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-4">
						<Field>
							<FieldLabel htmlFor={toId}>To</FieldLabel>
							<Input
								id={toId}
								type="email"
								value={to}
								onChange={(event) => setTo(event.target.value)}
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={subjectId}>Subject</FieldLabel>
							<Input
								id={subjectId}
								value={subject}
								onChange={(event) => {
									setSubject(event.target.value);
									setSubjectDirty(true);
								}}
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={noteId}>Personal note (optional)</FieldLabel>
							<Textarea
								id={noteId}
								rows={6}
								value={personalNote}
								onChange={(event) => setPersonalNote(event.target.value)}
							/>
						</Field>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-muted-foreground text-xs">Preview</span>
						<iframe
							title={`${entityLabel} email preview`}
							sandbox=""
							srcDoc={preview.data?.html ?? ""}
							className="h-80 w-full rounded-lg border bg-white"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={submit}
						disabled={mutation.isPending || hasUnknownMerge}
					>
						{mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
						Send {entityLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
