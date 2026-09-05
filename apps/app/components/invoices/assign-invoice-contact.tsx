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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function AssignInvoiceContact({
	invoiceId,
	contactId,
}: {
	invoiceId: string;
	contactId: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const contact = useQuery({
		...trpc.contacts.byId.queryOptions({ id: contactId ?? "" }),
		enabled: Boolean(contactId),
	});

	const contacts = useQuery({
		...trpc.contacts.options.queryOptions({ q: query }),
		enabled: open,
		placeholderData: (previous) => previous,
	});

	const assign = useMutation(
		trpc.invoices.update.mutationOptions({
			onSuccess: async () => {
				await cache.invoice(invoiceId, { settle: "record" });
				toast.success("Contact assigned.");
				setOpen(false);
				setText("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = (id: string) => {
		assign.mutate({ id: invoiceId, data: { contactId: id } });
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setText("");
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					{contact.data ? contactName(contact.data) : "Assign contact"}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" size="fit" className="w-80">
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
									onSelect={() => submit(candidate.id)}
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
			</PopoverContent>
		</Popover>
	);
}
