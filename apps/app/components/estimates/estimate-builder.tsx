"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Download from "@carbon/icons-react/es/Download";
import Money from "@carbon/icons-react/es/Money";
import Send from "@carbon/icons-react/es/Send";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
} from "@crm/ui/components/simple-table";
import { StatCard } from "@crm/ui/components/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AddLineItem } from "./add-line-item";
import { AssignEstimateContact } from "./assign-estimate-contact";
import { EstimateLineRow } from "./estimate-line-row";
import { SendEstimateDialog } from "./send-estimate-dialog";

export type EstimateDetail = RouterOutputs["estimates"]["byId"];
export type EstimateLineItemRow = EstimateDetail["lineItems"][number];
export type EstimateTier = EstimateDetail["selectedTier"];
export type EstimateStatusValue = EstimateDetail["status"];

type ResyncChange =
	RouterOutputs["estimates"]["resyncFromDrawing"]["changed"][number];

const TIER_LABEL: Record<EstimateTier, string> = {
	GOOD: "Good",
	BETTER: "Better",
	BEST: "Best",
};

const TIER_ORDER: EstimateTier[] = ["GOOD", "BETTER", "BEST"];

const TIER_TOTAL_FIELD: Record<
	EstimateTier,
	"goodCents" | "betterCents" | "bestCents"
> = {
	GOOD: "goodCents",
	BETTER: "betterCents",
	BEST: "bestCents",
};

const STATUS_ORDER: EstimateStatusValue[] = [
	"DRAFT",
	"SENT",
	"ACCEPTED",
	"DECLINED",
];

const STATUS_LABEL: Record<EstimateStatusValue, string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	ACCEPTED: "Accepted",
	DECLINED: "Declined",
};

const STATUS_VARIANT: Record<
	EstimateStatusValue,
	"secondary" | "outline" | "destructive"
> = {
	DRAFT: "secondary",
	SENT: "outline",
	ACCEPTED: "outline",
	DECLINED: "destructive",
};

const GENERAL_GROUP = "General";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Item" },
	{ id: "quantity", header: "Qty", width: "w-28", align: "right" },
	{ id: "unit", header: "Unit", width: "w-32" },
	{ id: "price", header: "Price", width: "w-36", align: "right" },
	{ id: "total", header: "Total", width: "w-32", align: "right" },
	{ id: "actions", srLabel: "Remove", width: "w-10" },
];

function groupLineItems(
	lineItems: EstimateLineItemRow[],
): [string, EstimateLineItemRow[]][] {
	const groups = new Map<string, EstimateLineItemRow[]>();
	const general: EstimateLineItemRow[] = [];

	for (const item of lineItems) {
		if (!item.areaLabel) {
			general.push(item);
			continue;
		}
		const list = groups.get(item.areaLabel) ?? [];
		list.push(item);
		groups.set(item.areaLabel, list);
	}

	const entries = Array.from(groups.entries());
	if (general.length > 0 || entries.length === 0) {
		entries.push([GENERAL_GROUP, general]);
	}
	return entries;
}

export function EstimateBuilder({
	estimateId,
	initialEstimate,
}: {
	estimateId: string;
	initialEstimate: EstimateDetail;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const titleId = useId();

	const estimate = useQuery({
		...trpc.estimates.byId.queryOptions({ id: estimateId }),
		initialData: initialEstimate,
	});

	const mailerConfigured = useQuery(
		trpc.estimates.mailerConfigured.queryOptions(),
	);

	const data = estimate.data;
	const tier = data.selectedTier;

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(data.title);
	const [resyncChanges, setResyncChanges] = useState<ResyncChange[] | null>(
		null,
	);
	const [downloading, setDownloading] = useState(false);
	const [sendOpen, setSendOpen] = useState(false);

	const setQueryData = (
		updater: (previous: EstimateDetail) => EstimateDetail,
	) => {
		queryClient.setQueryData(
			trpc.estimates.byId.queryKey({ id: estimateId }),
			(previous: EstimateDetail | undefined) =>
				previous ? updater(previous) : previous,
		);
	};

	const rename = useMutation(
		trpc.estimates.rename.mutationOptions({
			onSuccess: (result) => {
				setQueryData((previous) => ({ ...previous, title: result.title }));
				void cache.estimate(estimateId, { settle: "record" });
			},
			onError: (error) => {
				toast.error(error.message);
				setTitleDraft(data.title);
			},
		}),
	);

	const setStatus = useMutation(
		trpc.estimates.setStatus.mutationOptions({
			onMutate: (input) => {
				setQueryData((previous) => ({ ...previous, status: input.status }));
			},
			onSuccess: () => void cache.estimate(estimateId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setTier = useMutation(
		trpc.estimates.setTier.mutationOptions({
			onMutate: (input) => {
				setQueryData((previous) => ({
					...previous,
					selectedTier: input.tier,
				}));
			},
			onSuccess: () => void cache.estimate(estimateId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const resync = useMutation(
		trpc.estimates.resyncFromDrawing.mutationOptions({
			onSuccess: async (result) => {
				await cache.estimate(estimateId, { settle: "record" });
				if (result.changed.length === 0) {
					toast.success("Quantities already match.");
					return;
				}
				setResyncChanges(result.changed);
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
		rename.mutate({ id: estimateId, title: next });
	};

	const downloadPdf = async () => {
		setDownloading(true);
		try {
			const document = await queryClient.fetchQuery(
				trpc.estimates.document.queryOptions({ id: estimateId }),
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

	const groups = useMemo(
		() => groupLineItems(data.lineItems),
		[data.lineItems],
	);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					{editingTitle ? (
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
					) : (
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
					)}
				</PageShellHeading>
				<PageShellActions>
					<Select
						value={data.status}
						onValueChange={(status) =>
							setStatus.mutate({
								id: estimateId,
								status: status as EstimateStatusValue,
							})
						}
					>
						<SelectTrigger variant="ghost">
							<SelectValue>
								<Badge variant={STATUS_VARIANT[data.status]}>
									{STATUS_LABEL[data.status]}
								</Badge>
							</SelectValue>
						</SelectTrigger>
						<SelectContent align="end">
							{STATUS_ORDER.map((status) => (
								<SelectItem key={status} value={status}>
									{STATUS_LABEL[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{data.drawingId && (
						<>
							<Button variant="outline" size="sm" asChild>
								<Link href={workspaceUrl(`/drawings/${data.drawingId}`)}>
									View drawing
								</Link>
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={resync.isPending}
								onClick={() => resync.mutate({ id: estimateId })}
							>
								Re-sync from drawing
							</Button>
						</>
					)}
					<AssignEstimateContact
						estimateId={estimateId}
						contact={data.contact}
					/>
					<Button
						variant="outline"
						size="sm"
						disabled={downloading}
						onClick={downloadPdf}
					>
						<Icon icon={Download} data-icon="inline-start" />
						Download PDF
					</Button>
					{mailerConfigured.data ? (
						<Button size="sm" onClick={() => setSendOpen(true)}>
							<Icon icon={Send} data-icon="inline-start" />
							Send
						</Button>
					) : null}
					<Button variant="outline" size="sm" asChild>
						<Link href={workspaceUrl("/estimates")}>
							<Icon icon={ArrowLeft} data-icon="inline-start" />
							Back
						</Link>
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="flex flex-col gap-6">
					<Tabs
						value={tier}
						onValueChange={(next) =>
							setTier.mutate({ id: estimateId, tier: next as EstimateTier })
						}
					>
						<TabsList>
							{TIER_ORDER.map((value) => (
								<TabsTrigger key={value} value={value}>
									{TIER_LABEL[value]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>

					<div className="grid gap-3 sm:grid-cols-3">
						{TIER_ORDER.map((value) => (
							<StatCard
								key={value}
								label={TIER_LABEL[value]}
								value={formatMoney(
									data.totals[TIER_TOTAL_FIELD[value]],
									data.currency,
								)}
								className={cn(
									"rounded-lg border bg-card",
									value === tier && "border-primary ring-1 ring-primary/30",
								)}
							/>
						))}
					</div>

					{data.lineItems.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Icon icon={Money} />
								</EmptyMedia>
								<EmptyTitle>No line items yet</EmptyTitle>
								<EmptyDescription>
									Add a service from the price book, or a custom line.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div className="flex flex-col gap-6">
							{groups.map(([areaLabel, items]) => (
								<div key={areaLabel} className="flex flex-col gap-2">
									<h2 className="font-medium text-sm text-muted-foreground">
										{areaLabel}
									</h2>
									<SimpleTable columns={COLUMNS}>
										{items.map((item) => (
											<EstimateLineRow
												key={item.id}
												estimateId={estimateId}
												item={item}
												tier={tier}
												currency={data.currency}
											/>
										))}
									</SimpleTable>
								</div>
							))}
						</div>
					)}

					<div>
						<AddLineItem estimateId={estimateId} currency={data.currency} />
					</div>
				</div>
			</PageShellContent>

			<Dialog
				open={resyncChanges !== null}
				onOpenChange={(open) => {
					if (!open) setResyncChanges(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Quantities updated</DialogTitle>
						<DialogDescription>
							The drawing changed since this estimate was generated.
						</DialogDescription>
					</DialogHeader>
					<ul className="flex flex-col gap-1 text-sm">
						{resyncChanges?.map((change) => (
							<li key={change.lineItemId}>
								{change.name}: {change.oldQuantity} → {change.newQuantity}
							</li>
						))}
					</ul>
					<DialogFooter>
						<Button onClick={() => setResyncChanges(null)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<SendEstimateDialog
				estimateId={estimateId}
				title={data.title}
				defaultTo={data.contact?.email ?? ""}
				open={sendOpen}
				onOpenChange={setSendOpen}
			/>
		</PageShell>
	);
}
