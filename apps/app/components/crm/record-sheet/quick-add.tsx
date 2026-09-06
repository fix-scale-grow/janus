"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function QuickAddForm({
	submitLabel,
	pending,
	ready,
	onSubmit,
	onCancel,
	children,
}: {
	submitLabel: string;
	pending: boolean;
	ready: boolean;
	onSubmit: () => void;
	onCancel: () => void;
	children: React.ReactNode;
}) {
	return (
		<form
			className="flex shrink-0 flex-col gap-4 border-b px-5 py-4"
			action={onSubmit}
		>
			<div className="grid gap-4 sm:grid-cols-2">{children}</div>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={pending || !ready}>
					{pending ? <Spinner /> : null}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}

export function AttachDealContact({
	dealId,
	onDone,
}: {
	dealId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [contactId, setContactId] = useState("");
	const [role, setRole] = useState("");

	const personId = useId();
	const roleId = useId();

	const options = useQuery(trpc.deals.contactOptions.queryOptions({ dealId }));
	const candidates = options.data ?? [];

	const attach = useMutation(
		trpc.deals.attachContact.mutationOptions({
			onSuccess: async (attached) => {
				const person = candidates.find(
					(candidate) => candidate.id === attached.contactId,
				);
				await cache.deal(dealId);
				toast.success(
					person
						? `${contactName(person)} is on the deal.`
						: "Added to the deal.",
				);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const nobody = !options.isPending && candidates.length === 0;

	const placeholder = options.isPending
		? "Loading…"
		: nobody
			? "Everybody is already on it"
			: "Choose somebody";

	return (
		<QuickAddForm
			submitLabel="Add to deal"
			pending={attach.isPending}
			ready={contactId !== ""}
			onCancel={onDone}
			onSubmit={() =>
				attach.mutate({ dealId, contactId, role: role.trim() || null })
			}
		>
			<Field>
				<FieldLabel htmlFor={personId}>Person</FieldLabel>
				<Select value={contactId} onValueChange={setContactId}>
					<SelectTrigger id={personId} className="w-full" disabled={nobody}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{candidates.map((candidate) => (
							<SelectItem key={candidate.id} value={candidate.id}>
								{contactName(candidate)}
								{candidate.title ? ` · ${candidate.title}` : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={roleId}>Role</FieldLabel>
				<Input
					id={roleId}
					value={role}
					onChange={(event) => setRole(event.target.value)}
					placeholder="Champion"
					autoComplete="off"
				/>
			</Field>
		</QuickAddForm>
	);
}
