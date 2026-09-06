"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Download from "@carbon/icons-react/es/Download";
import Link_ from "@carbon/icons-react/es/Link";
import Send from "@carbon/icons-react/es/Send";
import StopSign from "@carbon/icons-react/es/StopSign";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { LocalDay } from "@/components/local-date-time";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import {
	BlockCanvas,
	type EditorBlock,
} from "@/components/templates/block-canvas";
import {
	toEditorHtml,
	toEditorText,
} from "@/components/templates/block-serialize";
import type { TemplateBlock } from "@/components/templates/merge-fields";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export type ContractDetailData = RouterOutputs["contracts"]["byId"];
export type ContractStatusValue = ContractDetailData["status"];

const STATUS_LABEL: Record<ContractStatusValue, string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	SIGNED: "Signed",
	VOID: "Void",
};

const STATUS_VARIANT: Record<ContractStatusValue, "secondary" | "outline"> = {
	DRAFT: "secondary",
	SENT: "outline",
	SIGNED: "outline",
	VOID: "secondary",
};

function StatusBadge({ status }: { status: ContractStatusValue }) {
	return (
		<Badge
			variant={STATUS_VARIANT[status]}
			className={cn(status === "VOID" && "line-through")}
		>
			{STATUS_LABEL[status]}
		</Badge>
	);
}

function contractBodyBlocks(body: TemplateBlock[] | null): TemplateBlock[] {
	return body ?? [];
}

function ContractBodyStatic({ blocks }: { blocks: TemplateBlock[] }) {
	if (blocks.length === 0) {
		return (
			<p className="rounded-lg border p-4 text-muted-foreground text-sm">
				This contract has no body.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			{blocks.map((block, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static, non-reorderable read-only render
				<ContractBodyBlockRow key={index} block={block} />
			))}
		</div>
	);
}

function ContractBodyBlockRow({ block }: { block: TemplateBlock }) {
	if (block.kind === "heading") {
		return (
			<h2
				className="font-semibold text-base"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorText(block.text) }}
			/>
		);
	}

	if (block.kind === "text") {
		return (
			<div
				className="whitespace-pre-wrap text-sm"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorHtml(block.html) }}
			/>
		);
	}

	if (block.kind === "divider") {
		return <hr className="border-t" />;
	}

	return null;
}

function LinkInvoicePicker({
	contractId,
	dealId,
	invoice,
	disabled,
}: {
	contractId: string;
	dealId: string | null;
	invoice: ContractDetailData["invoice"];
	disabled: boolean;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);

	const invoices = useQuery({
		...trpc.invoices.list.queryOptions({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 50,
			dealId: dealId ?? undefined,
		}),
		enabled: open && Boolean(dealId),
	});

	const link = useMutation(
		trpc.contracts.update.mutationOptions({
			onSuccess: async () => {
				await cache.contract(contractId, { settle: "record" });
				setOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (disabled) {
		return invoice ? (
			<span className="text-sm">#{invoice.number}</span>
		) : (
			<span className="text-muted-foreground text-sm">Not linked</span>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" disabled={!dealId}>
					<Icon icon={Link_} data-icon="inline-start" />
					{invoice ? `Invoice #${invoice.number}` : "Link invoice"}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" size="fit" className="w-72">
				<Command shouldFilter={false}>
					<CommandList>
						<CommandEmpty>
							{invoices.isFetching
								? "Loading invoices…"
								: "No invoices on this job."}
						</CommandEmpty>
						<CommandGroup>
							{invoice ? (
								<CommandItem
									disabled={link.isPending}
									onSelect={() =>
										link.mutate({ id: contractId, data: { invoiceId: null } })
									}
								>
									Clear link
								</CommandItem>
							) : null}
							{(invoices.data?.rows ?? []).map((row) => (
								<CommandItem
									key={row.id}
									disabled={link.isPending}
									onSelect={() =>
										link.mutate({
											id: contractId,
											data: { invoiceId: row.id },
										})
									}
								>
									#{row.number}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function SendForSignatureDialog({
	contractId,
	defaultTo,
	open,
	onOpenChange,
}: {
	contractId: string;
	defaultTo: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const toId = useId();
	const noteId = useId();

	const [to, setTo] = useState(defaultTo);
	const [note, setNote] = useState("");

	const send = useMutation(
		trpc.contracts.send.mutationOptions({
			onSuccess: async () => {
				await cache.contract(contractId, { settle: "record" });
				toast.success("Contract sent for signature.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		const trimmedTo = to.trim();
		if (!trimmedTo) {
			toast.error("Enter who this contract goes to.");
			return;
		}
		send.mutate({
			id: contractId,
			to: trimmedTo,
			personalNote: note.trim() || undefined,
		});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setTo(defaultTo);
					setNote("");
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send for signature</DialogTitle>
					<DialogDescription>
						This emails a signing link. Nothing sends until you press Send.
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
						<FieldLabel htmlFor={noteId}>Personal note (optional)</FieldLabel>
						<Textarea
							id={noteId}
							rows={4}
							value={note}
							onChange={(event) => setNote(event.target.value)}
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
						{send.isPending ? <Spinner data-icon="inline-start" /> : null}
						Send
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ContractDetail({
	contractId,
	initialContract,
}: {
	contractId: string;
	initialContract: ContractDetailData;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const titleId = useId();

	const contract = useQuery({
		...trpc.contracts.byId.queryOptions({ id: contractId }),
		initialData: initialContract,
	});

	const mailerConfigured = useQuery(
		trpc.contracts.mailerConfigured.queryOptions(),
	);

	const data = contract.data;
	const isDraft = data.status === "DRAFT";
	const canSend = data.status === "DRAFT" || data.status === "SENT";
	const canVoid = data.status === "DRAFT" || data.status === "SENT";
	const canLinkInvoice = data.status === "DRAFT" || data.status === "SENT";

	const contact = useQuery({
		...trpc.contacts.byId.queryOptions({ id: data.contactId ?? "" }),
		enabled: Boolean(data.contactId),
	});

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(data.title);
	const [downloading, setDownloading] = useState(false);
	const [sendOpen, setSendOpen] = useState(false);
	const [voidOpen, setVoidOpen] = useState(false);

	const nextId = useRef(0);
	const initialBlocks = useMemo(
		() => contractBodyBlocks(data.body),
		[data.body],
	);
	const [rows, setRows] = useState<EditorBlock[]>(() =>
		initialBlocks.map((block) => {
			const id = `block-${nextId.current}`;
			nextId.current += 1;
			return { id, block };
		}),
	);
	const [baseline, setBaseline] = useState(() => JSON.stringify(initialBlocks));
	const dirtyBody = JSON.stringify(rows.map((row) => row.block)) !== baseline;

	const setQueryData = (
		updater: (previous: ContractDetailData) => ContractDetailData,
	) => {
		queryClient.setQueryData(
			trpc.contracts.byId.queryKey({ id: contractId }),
			(previous: ContractDetailData | undefined) =>
				previous ? updater(previous) : previous,
		);
	};

	const rename = useMutation(
		trpc.contracts.update.mutationOptions({
			onSuccess: (result) => {
				setQueryData((previous) => ({ ...previous, title: result.title }));
				void cache.contract(contractId, { settle: "record" });
			},
			onError: (error) => {
				toast.error(error.message);
				setTitleDraft(data.title);
			},
		}),
	);

	const saveBody = useMutation(
		trpc.contracts.update.mutationOptions({
			onSuccess: async () => {
				setBaseline(JSON.stringify(rows.map((row) => row.block)));
				await cache.contract(contractId, { settle: "record" });
				toast.success("Contract body saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const voidContract = useMutation(
		trpc.contracts.void.mutationOptions({
			onSuccess: async () => {
				await cache.contract(contractId, { settle: "record" });
				toast.success("Contract voided.");
				setVoidOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitTitle = () => {
		setEditingTitle(false);
		const next = titleDraft.trim();
		if (!next || next === data.title) {
			setTitleDraft(data.title);
			return;
		}
		rename.mutate({ id: contractId, data: { title: next } });
	};

	const downloadPdf = async () => {
		setDownloading(true);
		try {
			const document = await queryClient.fetchQuery(
				trpc.contracts.document.queryOptions({ id: contractId }),
			);
			const bytes = Uint8Array.from(atob(document.base64), (char) =>
				char.charCodeAt(0),
			);
			const url = URL.createObjectURL(
				new Blob([bytes], { type: "application/pdf" }),
			);
			const anchor = window.document.createElement("a");
			anchor.href = url;
			anchor.download = document.filename;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not build the PDF.",
			);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					{isDraft && editingTitle ? (
						<Input
							id={titleId}
							autoFocus
							value={titleDraft}
							onChange={(event) => setTitleDraft(event.target.value)}
							onBlur={commitTitle}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									commitTitle();
								}
								if (event.key === "Escape") {
									setTitleDraft(data.title);
									setEditingTitle(false);
								}
							}}
							className="col-start-1 row-start-1 h-auto max-w-md py-1 font-medium text-2xl tracking-tight md:text-3xl"
						/>
					) : isDraft ? (
						<button
							type="button"
							onClick={() => {
								setTitleDraft(data.title);
								setEditingTitle(true);
							}}
							className="col-start-1 row-start-1 min-w-0 self-center text-left"
						>
							<PageShellTitle className="truncate">{data.title}</PageShellTitle>
						</button>
					) : (
						<PageShellTitle className="truncate">{data.title}</PageShellTitle>
					)}
				</PageShellHeading>
				<PageShellActions>
					<StatusBadge status={data.status} />
					<Button
						variant="outline"
						size="sm"
						disabled={downloading}
						onClick={downloadPdf}
					>
						<Icon icon={Download} data-icon="inline-start" />
						Download PDF
					</Button>
					{canSend && mailerConfigured.data ? (
						<Button size="sm" onClick={() => setSendOpen(true)}>
							<Icon icon={Send} data-icon="inline-start" />
							Send for signature
						</Button>
					) : null}
					{canVoid ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setVoidOpen(true)}
						>
							<Icon icon={StopSign} data-icon="inline-start" />
							Void
						</Button>
					) : null}
					<Button variant="outline" size="sm" asChild>
						<Link href={workspaceUrl("/contracts")}>
							<Icon icon={ArrowLeft} data-icon="inline-start" />
							Back
						</Link>
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="flex flex-col gap-6">
					<ContractTimeline data={data} />

					<div className="grid gap-3 sm:grid-cols-3">
						<div className="flex flex-col gap-1 rounded-lg border p-4">
							<span className="text-muted-foreground text-xs">Estimate</span>
							{data.estimate ? (
								<Link
									href={workspaceUrl(`/estimates/${data.estimate.id}`)}
									className="truncate text-sm hover:underline"
								>
									{data.estimate.title}
								</Link>
							) : (
								<span className="text-muted-foreground text-sm">
									Not from an estimate
								</span>
							)}
						</div>

						<div className="flex flex-col gap-1 rounded-lg border p-4">
							<span className="text-muted-foreground text-xs">Invoice</span>
							<LinkInvoicePicker
								contractId={contractId}
								dealId={data.dealId}
								invoice={data.invoice}
								disabled={!canLinkInvoice}
							/>
						</div>

						<div className="flex flex-col gap-1 rounded-lg border p-4">
							<span className="text-muted-foreground text-xs">Contact</span>
							{data.contact ? (
								<RecordLink
									kind="contact"
									id={data.contact.id}
									className="truncate text-sm"
								>
									{contactName(data.contact)}
								</RecordLink>
							) : (
								<span className="text-muted-foreground text-sm">
									No contact
								</span>
							)}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<h2 className="font-medium text-sm text-muted-foreground">
								Body
							</h2>
							{isDraft && dirtyBody ? (
								<Button
									size="sm"
									disabled={saveBody.isPending}
									onClick={() =>
										saveBody.mutate({
											id: contractId,
											data: { body: rows.map((row) => row.block) },
										})
									}
								>
									{saveBody.isPending ? (
										<Spinner data-icon="inline-start" />
									) : null}
									Save
								</Button>
							) : null}
						</div>
						{isDraft ? (
							<BlockCanvas blocks={rows} onChange={setRows} />
						) : (
							<ContractBodyStatic blocks={contractBodyBlocks(data.body)} />
						)}
					</div>
				</div>
			</PageShellContent>

			<SendForSignatureDialog
				contractId={contractId}
				defaultTo={data.sentTo ?? contact.data?.email ?? ""}
				open={sendOpen}
				onOpenChange={setSendOpen}
			/>

			<AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Void {data.title}?</AlertDialogTitle>
						<AlertDialogDescription>
							Nobody can sign it after this. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => voidContract.mutate({ id: contractId })}
						>
							Void
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageShell>
	);
}

function ContractTimeline({ data }: { data: ContractDetailData }) {
	if (data.status === "SIGNED" && data.signedAt) {
		return (
			<p className="text-muted-foreground text-sm">
				Signed by {data.signerName} on <LocalDay date={data.signedAt} />.
			</p>
		);
	}

	if (data.sentAt) {
		return (
			<p className="text-muted-foreground text-sm">
				Sent to {data.sentTo} on <LocalDay date={data.sentAt} />.
				{data.tokenExpiresAt ? (
					<>
						{" "}
						Expires <LocalDay date={data.tokenExpiresAt} />.
					</>
				) : null}
			</p>
		);
	}

	return null;
}
