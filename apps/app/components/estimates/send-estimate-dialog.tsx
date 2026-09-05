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
import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const DEFAULT_MESSAGE =
	"Hi,\n\nPlease find your estimate attached. Let us know if you have any questions.\n\nThanks!";

export function SendEstimateDialog({
	estimateId,
	title,
	defaultTo,
	open,
	onOpenChange,
}: {
	estimateId: string;
	title: string;
	defaultTo: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const toId = useId();
	const subjectId = useId();
	const messageId = useId();

	const [to, setTo] = useState(defaultTo);
	const [subject, setSubject] = useState(`Estimate — ${title}`);
	const [message, setMessage] = useState(DEFAULT_MESSAGE);

	useEffect(() => {
		if (!open) return;
		setTo(defaultTo);
		setSubject(`Estimate — ${title}`);
		setMessage(DEFAULT_MESSAGE);
	}, [open, defaultTo, title]);

	const send = useMutation(
		trpc.estimates.send.mutationOptions({
			onSuccess: async () => {
				await cache.estimate(estimateId, { settle: "record" });
				toast.success("Estimate sent.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		const trimmedTo = to.trim();
		const trimmedSubject = subject.trim();
		const trimmedMessage = message.trim();

		if (!trimmedTo) {
			toast.error("Enter who this estimate goes to.");
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

		send.mutate({
			id: estimateId,
			to: trimmedTo,
			subject: trimmedSubject,
			message: trimmedMessage,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send estimate</DialogTitle>
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
						disabled={send.isPending}
					>
						Cancel
					</Button>
					<Button onClick={submit} disabled={send.isPending}>
						{send.isPending ? <Spinner /> : null}
						Send estimate
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
