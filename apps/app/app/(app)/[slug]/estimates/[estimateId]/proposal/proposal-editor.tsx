"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Link_ from "@carbon/icons-react/es/Link";
import Renew from "@carbon/icons-react/es/Renew";
import Send from "@carbon/icons-react/es/Send";
import StopSign from "@carbon/icons-react/es/StopSign";
import View from "@carbon/icons-react/es/View";
import { TemplatePurpose } from "@crm/db/enums";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
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
import { Card, CardContent } from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { SendDocumentDialog } from "@/components/documents/send-document-dialog";
import {
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
import { BlockPalette } from "@/components/templates/block-palette";
import {
	type MergeFieldLabels,
	toEditorHtml,
	toEditorText,
} from "@/components/templates/block-serialize";
import {
	createTemplateBlock,
	type TemplateBlock,
	useMergeFields,
} from "@/components/templates/merge-fields";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type ProposalDetail = NonNullable<RouterOutputs["proposals"]["forEstimate"]>;
type ProposalStatusValue = ProposalDetail["status"];

const STATUS_LABEL: Record<ProposalStatusValue, string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	ACCEPTED: "Accepted",
	DECLINED: "Declined",
	VOID: "Void",
};

const STATUS_VARIANT: Record<ProposalStatusValue, "secondary" | "outline"> = {
	DRAFT: "secondary",
	SENT: "outline",
	ACCEPTED: "outline",
	DECLINED: "outline",
	VOID: "secondary",
};

const TIER_LABEL: Record<string, string> = {
	GOOD: "Good",
	BETTER: "Better",
	BEST: "Best",
};

export function ProposalEditor({ estimateId }: { estimateId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const workspaceUrl = useWorkspaceUrl();

	const proposal = useQuery(
		trpc.proposals.forEstimate.queryOptions({ estimateId }),
	);
	const estimate = useQuery(
		trpc.estimates.byId.queryOptions({ id: estimateId }),
	);

	const create = useMutation(
		trpc.proposals.createFromEstimate.mutationOptions({
			onSuccess: () => void cache.estimate(estimateId),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (proposal.isPending || estimate.isPending) {
		return (
			<PageShellContent>
				<div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
					<Spinner data-icon="inline-start" />
					Loading the proposal…
				</div>
			</PageShellContent>
		);
	}

	if (!proposal.data) {
		return (
			<PageShellContent>
				<div className="flex max-w-xl flex-col gap-4 py-10">
					<h1 className="font-semibold text-2xl">Build a proposal</h1>
					<p className="text-muted-foreground text-sm/6">
						A proposal wraps this estimate in a client-facing document: a cover,
						your pitch, the three pricing options and the job photos. The client
						opens a link, picks an option and accepts online.
					</p>
					<Button
						className="self-start"
						disabled={create.isPending}
						onClick={() => create.mutate({ estimateId })}
					>
						{create.isPending ? <Spinner data-icon="inline-start" /> : null}
						Build proposal
					</Button>
				</div>
			</PageShellContent>
		);
	}

	return (
		<ProposalBody
			estimateId={estimateId}
			proposal={proposal.data}
			estimateTitle={estimate.data?.title ?? ""}
			totals={estimate.data?.totals ?? null}
			currency={estimate.data?.currency ?? "USD"}
			contactId={estimate.data?.contactId ?? undefined}
			dealId={estimate.data?.dealId ?? undefined}
			defaultTo={estimate.data?.contact?.email ?? ""}
			backHref={workspaceUrl(`/estimates/${estimateId}`)}
		/>
	);
}

function ProposalBody({
	estimateId,
	proposal,
	estimateTitle,
	totals,
	currency,
	contactId,
	dealId,
	defaultTo,
	backHref,
}: {
	estimateId: string;
	proposal: ProposalDetail;
	estimateTitle: string;
	totals: { goodCents: number; betterCents: number; bestCents: number } | null;
	currency: string;
	contactId?: string;
	dealId?: string;
	defaultTo: string;
	backHref: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const workspaceUrl = useWorkspaceUrl();

	const coverTitleId = useId();
	const coverSubtitleId = useId();
	const [sendOpen, setSendOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [voidOpen, setVoidOpen] = useState(false);
	const [coverTitle, setCoverTitle] = useState(proposal.coverTitle ?? "");
	const [coverSubtitle, setCoverSubtitle] = useState(
		proposal.coverSubtitle ?? "",
	);

	const mailerConfigured = useQuery(
		trpc.proposals.mailerConfigured.queryOptions(),
	);

	const mergeFields = useMergeFields();
	const labels: MergeFieldLabels = useMemo(
		() =>
			Object.fromEntries(
				mergeFields.groups.flatMap((group) =>
					group.fields.map((field) => [field.token, field.label]),
				),
			),
		[mergeFields.groups],
	);

	const nextId = useRef(0);
	const [rows, setRows] = useState<EditorBlock[]>(() =>
		proposal.body.map((block) => {
			const id = `block-${nextId.current}`;
			nextId.current += 1;
			return { id, block };
		}),
	);
	const [baseline, setBaseline] = useState(() => JSON.stringify(proposal.body));
	const dirtyBody = JSON.stringify(rows.map((row) => row.block)) !== baseline;

	const settle = () => cache.estimate(estimateId, { settle: "record" });

	const update = useMutation(
		trpc.proposals.update.mutationOptions({
			onSuccess: () => void settle(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveBody = useMutation(
		trpc.proposals.update.mutationOptions({
			onSuccess: () => {
				setBaseline(JSON.stringify(rows.map((row) => row.block)));
				void settle();
				toast.success("Proposal saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const sendProposal = useMutation(
		trpc.proposals.send.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Proposal sent.");
				setSendOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const revise = useMutation(
		trpc.proposals.revise.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("New draft revision created.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const voidProposal = useMutation(
		trpc.proposals.void.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Proposal voided.");
				setVoidOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const editable = proposal.status === "DRAFT";
	const viewToken = proposal.viewToken;

	const commitCover = (
		field: "coverTitle" | "coverSubtitle",
		value: string,
	) => {
		const next = value.trim() || null;
		const current =
			field === "coverTitle" ? proposal.coverTitle : proposal.coverSubtitle;
		if (next === (current ?? null)) return;
		update.mutate({ id: proposal.id, data: { [field]: next } });
	};

	return (
		<>
			<PageShellHeader>
				<PageShellHeading>
					<div className="flex items-center gap-2">
						<Button asChild variant="ghost" size="icon-sm">
							<Link href={backHref} aria-label="Back to the estimate">
								<Icon icon={ArrowLeft} />
							</Link>
						</Button>
						<PageShellTitle>Proposal #{proposal.number}</PageShellTitle>
						<Badge variant={STATUS_VARIANT[proposal.status]}>
							{STATUS_LABEL[proposal.status]}
						</Badge>
						{proposal.revision > 1 ? (
							<Badge variant="outline">Revision {proposal.revision}</Badge>
						) : null}
					</div>
				</PageShellHeading>
				<PageShellActions>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setPreviewOpen(true)}
					>
						<Icon icon={View} data-icon="inline-start" />
						Preview
					</Button>
					{viewToken && proposal.status === "SENT" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								void navigator.clipboard.writeText(
									`${window.location.origin}/proposal/${viewToken}`,
								);
								toast.success("Link copied.");
							}}
						>
							<Icon icon={Link_} data-icon="inline-start" />
							Copy link
						</Button>
					) : null}
					{(proposal.status === "DRAFT" || proposal.status === "SENT") &&
					mailerConfigured.data ? (
						<Button size="sm" onClick={() => setSendOpen(true)}>
							<Icon icon={Send} data-icon="inline-start" />
							{proposal.status === "SENT" ? "Resend" : "Send"}
						</Button>
					) : null}
					{proposal.status !== "DRAFT" ? (
						<Button
							variant="outline"
							size="sm"
							disabled={revise.isPending}
							onClick={() => revise.mutate({ id: proposal.id })}
						>
							{revise.isPending ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Icon icon={Renew} data-icon="inline-start" />
							)}
							Revise
						</Button>
					) : null}
					{proposal.status === "DRAFT" || proposal.status === "SENT" ? (
						<Button variant="ghost" size="sm" onClick={() => setVoidOpen(true)}>
							<Icon icon={StopSign} data-icon="inline-start" />
							Void
						</Button>
					) : null}
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="flex max-w-3xl flex-col gap-6">
					{proposal.status !== "DRAFT" ? (
						<p className="text-muted-foreground text-sm">
							{proposal.viewCount === 0
								? "The client has not opened this proposal yet."
								: `Opened ${proposal.viewCount === 1 ? "once" : `${proposal.viewCount} times`}${
										proposal.lastViewedAt
											? `, last on ${new Date(proposal.lastViewedAt).toLocaleDateString()}`
											: ""
									}.`}
						</p>
					) : null}

					{proposal.status === "DECLINED" ? (
						<Alert variant="warning">
							<Icon icon={StopSign} />
							<AlertTitle>
								Declined
								{proposal.declinedName ? ` by ${proposal.declinedName}` : ""}.
							</AlertTitle>
							<AlertDescription>
								{proposal.declineNote
									? `"${proposal.declineNote}"`
									: "No reason was given."}{" "}
								Use Revise to start a new draft when you are ready to try again.
							</AlertDescription>
						</Alert>
					) : null}

					{proposal.status === "ACCEPTED" ? (
						<Alert>
							<Icon icon={Checkmark} />
							<AlertTitle>
								Accepted
								{proposal.acceptedName ? ` by ${proposal.acceptedName}` : ""}
								{proposal.acceptedTier
									? ` at the ${TIER_LABEL[proposal.acceptedTier]} option`
									: ""}
								.
							</AlertTitle>
							<AlertDescription>
								A draft contract was created from this estimate. Find it on the{" "}
								<Link className="underline" href={workspaceUrl("/contracts")}>
									Contracts page
								</Link>{" "}
								and send it for signature.
							</AlertDescription>
						</Alert>
					) : null}

					<Card>
						<CardContent className="flex flex-col gap-4 py-6">
							<div className="flex flex-col gap-1">
								<h2 className="font-semibold text-base">Cover</h2>
								<p className="text-muted-foreground text-sm">
									The first thing the client sees. Leave the title blank to use
									the estimate title.
								</p>
							</div>
							<Field>
								<FieldLabel htmlFor={coverTitleId}>Cover title</FieldLabel>
								<Input
									id={coverTitleId}
									value={coverTitle}
									onChange={(event) => setCoverTitle(event.target.value)}
									onBlur={() => commitCover("coverTitle", coverTitle)}
									placeholder={estimateTitle}
									disabled={!editable && proposal.status !== "SENT"}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={coverSubtitleId}>
									Cover subtitle
								</FieldLabel>
								<Input
									id={coverSubtitleId}
									value={coverSubtitle}
									onChange={(event) => setCoverSubtitle(event.target.value)}
									onBlur={() => commitCover("coverSubtitle", coverSubtitle)}
									placeholder="One line that sets the tone"
									disabled={!editable && proposal.status !== "SENT"}
								/>
							</Field>
						</CardContent>
					</Card>

					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-1">
								<h2 className="font-semibold text-base">Content</h2>
								<p className="text-muted-foreground text-sm">
									{editable
										? "Your pitch. Drag blocks to reorder; merge fields fill from the job."
										: "Content is locked after sending. Void the proposal to edit again."}
								</p>
							</div>
							{editable ? (
								<Button
									size="sm"
									disabled={!dirtyBody || saveBody.isPending}
									onClick={() =>
										saveBody.mutate({
											id: proposal.id,
											data: { body: rows.map((row) => row.block) },
										})
									}
								>
									{saveBody.isPending ? (
										<Spinner data-icon="inline-start" />
									) : null}
									Save content
								</Button>
							) : null}
						</div>
						{editable ? (
							<div className="grid gap-4 md:grid-cols-[1fr_200px]">
								<BlockCanvas blocks={rows} onChange={setRows} labels={labels} />
								<BlockPalette
									purpose={TemplatePurpose.PROPOSAL_BODY}
									onAdd={(kind) => {
										const id = `block-${nextId.current}`;
										nextId.current += 1;
										setRows([
											...rows,
											{ id, block: createTemplateBlock(kind) },
										]);
									}}
								/>
							</div>
						) : (
							<StaticBlocks
								blocks={proposal.body as TemplateBlock[]}
								labels={labels}
							/>
						)}
					</div>

					<Card>
						<CardContent className="flex flex-col gap-3 py-6">
							<div className="flex flex-col gap-1">
								<h2 className="font-semibold text-base">Pricing and photos</h2>
								<p className="text-muted-foreground text-sm">
									Pulled live from the estimate. Change line items or photos on
									the estimate and the proposal follows.
								</p>
							</div>
							{totals ? (
								<div className="grid gap-3 sm:grid-cols-3">
									{(
										[
											["Good", totals.goodCents],
											["Better", totals.betterCents],
											["Best", totals.bestCents],
										] as const
									).map(([label, cents]) => (
										<div
											key={label}
											className={cn(
												"flex flex-col gap-1 rounded-lg border p-4",
												proposal.acceptedTier &&
													TIER_LABEL[proposal.acceptedTier] === label &&
													"border-primary ring-2 ring-primary/30",
											)}
										>
											<span className="text-muted-foreground text-xs">
												{label}
											</span>
											<span className="font-semibold text-lg tabular-nums">
												{formatMoney(cents, currency)}
											</span>
										</div>
									))}
								</div>
							) : null}
						</CardContent>
					</Card>
				</div>
			</PageShellContent>

			<SendDocumentDialog
				documentId={proposal.id}
				entityLabel="proposal"
				purpose={TemplatePurpose.PROPOSAL_SEND}
				refs={{ estimateId, dealId, contactId }}
				defaultTo={proposal.sentTo ?? defaultTo}
				open={sendOpen}
				onOpenChange={setSendOpen}
				mutation={sendProposal}
			/>

			<DocumentPreviewDialog
				open={previewOpen}
				onOpenChange={setPreviewOpen}
				kind="proposal"
				documentId={proposal.id}
				entityLabel="proposal"
				purpose={TemplatePurpose.PROPOSAL_SEND}
				refs={{ estimateId, dealId, contactId }}
			/>

			<AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Void this proposal?</AlertDialogTitle>
						<AlertDialogDescription>
							The client's link stops working and the proposal unlocks for
							editing again after you rebuild it. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={voidProposal.isPending}
							onClick={() => voidProposal.mutate({ id: proposal.id })}
						>
							Void proposal
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function StaticBlocks({
	blocks,
	labels,
}: {
	blocks: TemplateBlock[];
	labels: MergeFieldLabels;
}) {
	if (blocks.length === 0) {
		return (
			<p className="rounded-lg border p-4 text-muted-foreground text-sm">
				This proposal has no content sections.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			{blocks.map((block, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static, non-reorderable read-only render
				<StaticBlockRow key={index} block={block} labels={labels} />
			))}
		</div>
	);
}

function StaticBlockRow({
	block,
	labels,
}: {
	block: TemplateBlock;
	labels: MergeFieldLabels;
}) {
	if (block.kind === "heading") {
		return (
			<h3
				className="font-semibold text-base"
				style={{ textAlign: block.align, color: block.color }}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorText(block.text, labels) }}
			/>
		);
	}
	if (block.kind === "text") {
		return (
			<div
				className="whitespace-pre-wrap text-sm"
				style={{ textAlign: block.align, color: block.color }}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorHtml(block.html, labels) }}
			/>
		);
	}
	if (block.kind === "divider") {
		return <hr className="border-t" />;
	}
	return null;
}
