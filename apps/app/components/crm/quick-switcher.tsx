"use client";

import Chat from "@carbon/icons-react/es/Chat";
import {
	Command,
	CommandDialog,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { AgentPanel } from "@/components/crm/agent-panel";
import {
	useOpenRecord,
	useRecordSheetView,
} from "@/components/crm/record-sheet/record-stack";
import { isQuestionShaped } from "@/lib/ask-detect";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const GROUP_LABEL = {
	contact: "Contacts",
	deal: "Jobs",
	invoice: "Invoices",
	contract: "Contracts",
	drawing: "Drawings",
	estimate: "Estimates",
} as const;

const KINDS = [
	"contact",
	"deal",
	"invoice",
	"contract",
	"drawing",
	"estimate",
] as const;

const PAGE_PATH: Partial<Record<(typeof KINDS)[number], string>> = {
	invoice: "/invoices",
	contract: "/contracts",
	drawing: "/drawings",
	estimate: "/estimates",
};

export function QuickSwitcher() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const [open, setOpen] = useQueryState("k", parseAsBoolean.withDefault(false));
	const [committed, setCommitted] = useState("");
	const [query, setQuery] = useSearchInput(committed, setCommitted);
	const [askOpen, setAskOpen] = useState(false);
	const [askMessage, setAskMessage] = useState<string | undefined>();
	const { setThread } = useRecordSheetView("overview");

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				void setOpen((current) => (current ? null : true));
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [setOpen]);

	const results = useQuery({
		...trpc.search.quick.queryOptions({ q: committed }),
		enabled: open && committed.trim().length >= 2,
		placeholderData: (previous) => previous,
	});

	const hits = results.data?.hits ?? [];
	const trimmedQuery = query.trim();

	const close = () => {
		setQuery("");
		setCommitted("");
		void setOpen(null);
	};

	const go = (kind: (typeof KINDS)[number], id: string) => {
		close();

		if (kind === "contact" || kind === "deal") {
			openRecord({ kind, id });
			return;
		}

		const base = PAGE_PATH[kind];
		if (base) router.push(workspaceUrl(`${base}/${id}`));
	};

	const askJanus = () => {
		const message = trimmedQuery;
		close();
		setAskMessage(message.length > 0 ? message : undefined);
		setAskOpen(true);
	};

	const helperText =
		trimmedQuery.length < 2
			? "Type at least two characters."
			: hits.length === 0
				? "Nothing matches."
				: null;

	const askFirst = trimmedQuery.length > 0 && isQuestionShaped(trimmedQuery);
	const askValue = `ask-janus:${trimmedQuery}`;
	const askRow =
		trimmedQuery.length > 0 ? (
			<CommandItem value={askValue} onSelect={askJanus}>
				<Icon icon={Chat} />
				<span className="truncate">Ask Janus: "{trimmedQuery}"</span>
			</CommandItem>
		) : null;

	const firstHit = hits[0];
	const defaultValue =
		!askFirst && firstHit
			? `${firstHit.kind}:${firstHit.id}`
			: trimmedQuery.length > 0
				? askValue
				: undefined;
	const [selected, setSelected] = useState(defaultValue);

	useEffect(() => {
		setSelected(defaultValue);
	}, [defaultValue]);

	return (
		<>
			<CommandDialog
				open={open}
				onOpenChange={(next) => setOpen(next || null)}
				title="Search"
				description="Search or ask Janus"
			>
				<Command
					shouldFilter={false}
					value={selected}
					onValueChange={setSelected}
				>
					<CommandInput
						placeholder="Search or ask Janus…"
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{helperText ? (
							<div className="px-2 py-6 text-center text-muted-foreground text-xs">
								{helperText}
							</div>
						) : null}

						{askFirst && askRow ? (
							<CommandGroup heading="Ask Janus">{askRow}</CommandGroup>
						) : null}

						{KINDS.map((kind) => {
							const group = hits.filter((hit) => hit.kind === kind);
							if (group.length === 0) return null;

							return (
								<CommandGroup key={kind} heading={GROUP_LABEL[kind]}>
									{group.map((hit) => (
										<CommandItem
											key={`${hit.kind}:${hit.id}`}
											value={`${hit.kind}:${hit.id}`}
											onSelect={() => go(kind, hit.id)}
										>
											{hit.kind === "contact" ? (
												<PersonAvatar
													src={hit.imageUrl}
													name={hit.label}
													size="sm"
												/>
											) : (
												<EntityLogo
													src={hit.iconUrl}
													darkSrc={hit.iconDarkUrl}
													tone={
														hit.iconTone as EntityLogoTone | null | undefined
													}
													name={hit.label}
													size="sm"
												/>
											)}
											<span className="flex min-w-0 flex-col">
												<span className="truncate">{hit.label}</span>
												{hit.detail ? (
													<span className="truncate text-muted-foreground text-xs">
														{hit.detail}
													</span>
												) : null}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							);
						})}

						{!askFirst && askRow ? (
							<CommandGroup heading="Ask Janus">{askRow}</CommandGroup>
						) : null}
					</CommandList>
				</Command>
			</CommandDialog>

			<Sheet
				open={askOpen}
				onOpenChange={(next) => {
					setAskOpen(next);
					if (!next) {
						setAskMessage(undefined);
						setThread(null);
					}
				}}
			>
				<SheetContent className="gap-0 p-0" size="lg">
					<SheetHeader className="border-b">
						<SheetTitle>Ask Janus</SheetTitle>
					</SheetHeader>
					<AgentPanel
						record={{ kind: "workspace", id: "workspace" }}
						initialMessage={askMessage}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}
