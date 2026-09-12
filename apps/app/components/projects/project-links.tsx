"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Project = RouterOutputs["projects"]["byId"];

const PICKER_BASE = {
	sort: "",
	dir: "desc",
	page: 1,
	pageSize: 20,
} as const;

function useProjectLinkUpdate(projectId: string) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	return useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);
}

function LinkPicker({
	placeholder,
	searchPlaceholder,
	linkedLabel,
	onOpenLinked,
	options,
	text,
	onTextChange,
	stale,
	onPick,
	onUnlink,
}: {
	placeholder: string;
	searchPlaceholder: string;
	linkedLabel: string | null;
	onOpenLinked?: () => void;
	options: { value: string; label: string }[];
	text: string;
	onTextChange: (value: string) => void;
	stale: boolean;
	onPick: (id: string) => void;
	onUnlink: () => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<span className="flex items-center gap-0.5 truncate">
			{linkedLabel ? (
				<button
					type="button"
					onClick={onOpenLinked}
					className="truncate underline-offset-2 hover:underline"
				>
					{linkedLabel}
				</button>
			) : null}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
					>
						{linkedLabel ? null : placeholder}
						<Icon icon={ChevronDown} className="size-3 shrink-0" />
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-64 p-0">
					<Command shouldFilter={false}>
						<CommandInput
							value={text}
							onValueChange={onTextChange}
							placeholder={searchPlaceholder}
						/>
						<CommandList data-stale={stale || undefined}>
							<CommandEmpty>Nothing matches.</CommandEmpty>
							<CommandGroup>
								{linkedLabel ? (
									<CommandItem
										value="__unlink__"
										onSelect={() => {
											onUnlink();
											setOpen(false);
										}}
									>
										Unlink {linkedLabel}
									</CommandItem>
								) : null}
								{options.map((option) => (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={() => {
											onPick(option.value);
											setOpen(false);
										}}
									>
										{option.label}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</span>
	);
}

export function ProjectClientLink({ project }: { project: Project }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const update = useProjectLinkUpdate(project.id);
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const contacts = useQuery({
		...trpc.contacts.options.queryOptions({ q: query }),
		placeholderData: (previous) => previous,
	});

	return (
		<LinkPicker
			placeholder="+ Client"
			searchPlaceholder="Search contacts…"
			linkedLabel={project.contact ? contactName(project.contact) : null}
			onOpenLinked={
				project.contact
					? () =>
							openRecord({
								kind: "contact",
								id: project.contact?.id ?? "",
							})
					: undefined
			}
			options={(contacts.data ?? []).map((contact) => ({
				value: contact.id,
				label: contactName(contact),
			}))}
			text={text}
			onTextChange={setText}
			stale={contacts.isFetching}
			onPick={(contactId) => update.mutate({ id: project.id, contactId })}
			onUnlink={() => update.mutate({ id: project.id, contactId: null })}
		/>
	);
}

export function ProjectEstimateLink({ project }: { project: Project }) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const update = useProjectLinkUpdate(project.id);
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const estimates = useQuery({
		...trpc.estimates.list.queryOptions({ ...PICKER_BASE, q: query }),
		placeholderData: (previous) => previous,
	});

	return (
		<LinkPicker
			placeholder="+ Estimate"
			searchPlaceholder="Search estimates…"
			linkedLabel={project.estimate?.title ?? null}
			onOpenLinked={
				project.estimate
					? () =>
							router.push(workspaceUrl(`/estimates/${project.estimate?.id}`))
					: undefined
			}
			options={(estimates.data?.rows ?? []).map((estimate) => ({
				value: estimate.id,
				label: estimate.title,
			}))}
			text={text}
			onTextChange={setText}
			stale={estimates.isFetching}
			onPick={(estimateId) => update.mutate({ id: project.id, estimateId })}
			onUnlink={() => update.mutate({ id: project.id, estimateId: null })}
		/>
	);
}

export function ProjectInvoiceLink({ project }: { project: Project }) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const update = useProjectLinkUpdate(project.id);
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const invoices = useQuery({
		...trpc.invoices.list.queryOptions({ ...PICKER_BASE, q: query }),
		placeholderData: (previous) => previous,
	});

	return (
		<LinkPicker
			placeholder="+ Invoice"
			searchPlaceholder="Search invoices…"
			linkedLabel={
				project.invoice ? `Invoice #${project.invoice.number}` : null
			}
			onOpenLinked={
				project.invoice
					? () => router.push(workspaceUrl(`/invoices/${project.invoice?.id}`))
					: undefined
			}
			options={(invoices.data?.rows ?? []).map((invoice) => ({
				value: invoice.id,
				label: `Invoice #${invoice.number}`,
			}))}
			text={text}
			onTextChange={setText}
			stale={invoices.isFetching}
			onPick={(invoiceId) => update.mutate({ id: project.id, invoiceId })}
			onUnlink={() => update.mutate({ id: project.id, invoiceId: null })}
		/>
	);
}

const DEAL_PICKER_BASE = {
	...PICKER_BASE,
	status: "all",
	owner: "all",
	stage: "all",
	closing: "all",
} as const;

export function ProjectDealLink({ project }: { project: Project }) {
	const trpc = useTRPC();
	const update = useProjectLinkUpdate(project.id);
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const deals = useQuery({
		...trpc.deals.list.queryOptions({ ...DEAL_PICKER_BASE, q: query }),
		placeholderData: (previous) => previous,
		enabled: project.deal === null,
	});

	if (project.deal) return null;

	return (
		<LinkPicker
			placeholder="+ Deal"
			searchPlaceholder="Search deals…"
			linkedLabel={null}
			options={(deals.data?.rows ?? []).map((deal) => ({
				value: deal.id,
				label: deal.name,
			}))}
			text={text}
			onTextChange={setText}
			stale={deals.isFetching}
			onPick={(dealId) => update.mutate({ id: project.id, dealId })}
			onUnlink={() => update.mutate({ id: project.id, dealId: null })}
		/>
	);
}
