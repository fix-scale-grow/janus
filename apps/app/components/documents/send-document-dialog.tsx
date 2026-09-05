"use client";

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
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

export type SendDocumentMutation = {
	mutate: (input: {
		id: string;
		to: string;
		subject: string;
		message: string;
	}) => void;
	isPending: boolean;
};

export function SendDocumentDialog({
	documentId,
	entityLabel,
	defaultSubject,
	defaultTo,
	defaultMessage,
	open,
	onOpenChange,
	mutation,
}: {
	documentId: string;
	entityLabel: string;
	defaultSubject: string;
	defaultTo: string;
	defaultMessage: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mutation: SendDocumentMutation;
}) {
	const toId = useId();
	const subjectId = useId();
	const messageId = useId();

	const [to, setTo] = useState(defaultTo);
	const [subject, setSubject] = useState(defaultSubject);
	const [message, setMessage] = useState(defaultMessage);

	useEffect(() => {
		if (!open) return;
		setTo(defaultTo);
		setSubject(defaultSubject);
		setMessage(defaultMessage);
	}, [open, defaultTo, defaultSubject, defaultMessage]);

	const submit = () => {
		const trimmedTo = to.trim();
		const trimmedSubject = subject.trim();
		const trimmedMessage = message.trim();

		if (!trimmedTo) {
			toast.error(`Enter who this ${entityLabel} goes to.`);
			return;
		}
		if (!trimmedSubject) {
			toast.error("Give the email a subject.");
			return;
		}
		if (!trimmedMessage) {
			toast.error("Write a short message.");
			return;
		}

		mutation.mutate({
			id: documentId,
			to: trimmedTo,
			subject: trimmedSubject,
			message: trimmedMessage,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send {entityLabel}</DialogTitle>
					<DialogDescription>
						This emails the PDF as an attachment. Nothing sends until you press
						Send.
					</DialogDescription>
				</DialogHeader>
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
							onChange={(event) => setSubject(event.target.value)}
							autoComplete="off"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={messageId}>Message</FieldLabel>
						<Textarea
							id={messageId}
							rows={6}
							value={message}
							onChange={(event) => setMessage(event.target.value)}
						/>
					</Field>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button onClick={submit} disabled={mutation.isPending}>
						{mutation.isPending ? <Spinner /> : null}
						Send {entityLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
