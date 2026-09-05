"use client";

import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

export type EstimateContact = RouterOutputs["estimates"]["byId"]["contact"];

export function AssignEstimateContact({
	estimateId,
	contact,
}: {
	estimateId: string;
	contact: EstimateContact;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"existing" | "new">("existing");
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);
	const [newName, setNewName] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newPhone, setNewPhone] = useState("");

	const nameId = useId();
	const emailId = useId();
	const phoneId = useId();

	const contacts = useQuery({
		...trpc.contacts.options.queryOptions({ q: query }),
		enabled: open && mode === "existing",
		placeholderData: (previous) => previous,
	});

	const reset = () => {
		setMode("existing");
		setText("");
		setNewName("");
		setNewEmail("");
		setNewPhone("");
	};

	const assign = useMutation(
		trpc.estimates.assignContact.mutationOptions({
			onSuccess: async () => {
				await cache.estimate(estimateId, { settle: "record" });
				toast.success("Contact assigned.");
				setOpen(false);
				reset();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submitExisting = (contactId: string) => {
		assign.mutate({ id: estimateId, contactId });
	};

	const submitNew = () => {
		const name = newName.trim();
		const email = newEmail.trim();

		if (!name || !email) {
			toast.error("A new contact needs a name and an email address.");
			return;
		}

		assign.mutate({
			id: estimateId,
			newContact: { name, email, phone: newPhone.trim() || undefined },
		});
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					{contact ? contactName(contact) : "Assign contact"}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" size="fit" className="w-80">
				<div className="flex gap-1 border-b p-1">
					<Button
						variant={mode === "existing" ? "secondary" : "ghost"}
						size="sm"
						className="flex-1"
						onClick={() => setMode("existing")}
					>
						Existing contact
					</Button>
					<Button
						variant={mode === "new" ? "secondary" : "ghost"}
						size="sm"
						className="flex-1"
						onClick={() => setMode("new")}
					>
						New contact
					</Button>
				</div>

				{mode === "existing" ? (
					<Command
						shouldFilter={false}
						onKeyDown={(event) => event.stopPropagation()}
					>
						<CommandInput
							placeholder="Search contacts…"
							value={text}
							onValueChange={setText}
							autoFocus
						/>
						<CommandList>
							<CommandEmpty>
								{contacts.isFetching ? "Searching…" : "No contact matches."}
							</CommandEmpty>
							<CommandGroup>
								{(contacts.data ?? []).map((candidate) => (
									<CommandItem
										key={candidate.id}
										value={contactName(candidate)}
										disabled={assign.isPending}
										onSelect={() => submitExisting(candidate.id)}
									>
										<span className="truncate">{contactName(candidate)}</span>
										{candidate.email ? (
											<span className="ml-auto truncate text-muted-foreground text-xs">
												{candidate.email}
											</span>
										) : null}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				) : (
					<div className="flex flex-col gap-3 p-3">
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								autoFocus
								value={newName}
								onChange={(event) => setNewName(event.target.value)}
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={newEmail}
								onChange={(event) => setNewEmail(event.target.value)}
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
							<Input
								id={phoneId}
								value={newPhone}
								onChange={(event) => setNewPhone(event.target.value)}
								autoComplete="off"
							/>
						</Field>
						<Button
							className="mt-1 w-full"
							disabled={assign.isPending}
							onClick={submitNew}
						>
							Add & assign
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
