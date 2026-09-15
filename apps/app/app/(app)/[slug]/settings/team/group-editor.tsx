"use client";

import type {
	AccessArea,
	AccessLevel,
	AccessScope,
	AccessSurface,
} from "@crm/db/access-config";
import { ACCESS } from "@crm/db/access-config";
import type { AccessPolicy } from "@crm/db/access-policy";
import { Alert, AlertDescription } from "@crm/ui/components/alert";
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
import { Button, buttonVariants } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldTitle,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { SaveBar } from "@crm/ui/components/save-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useReducer, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { type GroupDraft, groupEditorReducer } from "./group-editor-state";

export type AccessGroupRow = RouterOutputs["accessGroups"]["list"][number];

const SCOPE_LABEL: Record<AccessScope, string> = {
	ALL: "All records",
	OWN: "Their deals (owned or assigned)",
	ASSIGNED: "Assigned only (them or their crew)",
};

const LEVEL_LABEL: Record<AccessLevel, string> = {
	HIDDEN: "Hidden",
	VIEW: "View",
	EDIT: "Edit",
	DELETE: "Delete",
};

const ACTION_LABEL: Record<string, string> = {
	"jobCosts.submit": "Submit receipts",
	"deals.markComplete": "Mark job complete",
	"contracts.signInPerson": "Sign on site",
};

const ACTION_HINT: Record<string, string> = {
	"jobCosts.submit":
		"Add a cost and receipt to their jobs without seeing the cost ledger.",
	"deals.markComplete": "Move their job to complete. Nothing else changes.",
	"contracts.signInPerson": "Homeowner signs on this person's phone.",
};

const MONEY_LABEL: Record<string, string> = {
	prices: "See prices",
	profit: "See job costs and profit",
	priceBook: "Edit the price book",
};

const MONEY_HINT: Record<string, string> = {
	prices: "Unit prices and totals on estimates, invoices and contracts.",
	profit: "Cost ledger, profit, collected, money reports.",
	priceBook: "Change services and prices.",
};

function areaLabel(area: AccessArea): string {
	const label = ACCESS.areaLabel[area];
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function pluralize(count: number, singular: string, plural: string): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

function blankPolicy(): AccessPolicy {
	return {
		areas: Object.fromEntries(
			ACCESS.areas.map((area) => [area, "HIDDEN"]),
		) as AccessPolicy["areas"],
		actions: [],
		money: [],
	};
}

export function blankDraft(): GroupDraft {
	return {
		id: null,
		name: "New group",
		surface: "FULL",
		scope: "OWN",
		policy: blankPolicy(),
	};
}

export function draftFromRow(row: AccessGroupRow): GroupDraft {
	return {
		id: row.id,
		name: row.name,
		surface: row.surface,
		scope: row.scope,
		policy: row.policy,
	};
}

function sameArray(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((value, index) => value === sortedB[index]);
}

function sameDraft(a: GroupDraft, b: GroupDraft): boolean {
	if (a.name !== b.name) return false;
	if (a.surface !== b.surface) return false;
	if (a.scope !== b.scope) return false;
	if (
		ACCESS.areas.some((area) => a.policy.areas[area] !== b.policy.areas[area])
	) {
		return false;
	}
	if (!sameArray(a.policy.actions, b.policy.actions)) return false;
	if (!sameArray(a.policy.money, b.policy.money)) return false;
	return true;
}

function firstName(name: string): string {
	return name.split(" ")[0] ?? name;
}

function DeleteGroupButton({
	groupName,
	memberCount,
	pending,
	onConfirm,
}: {
	groupName: string;
	memberCount: number;
	pending: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);
	const disabled = memberCount > 0 || pending;

	return (
		<>
			{memberCount > 0 ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							aria-disabled
							className={cn(
								buttonVariants({ variant: "destructive", size: "sm" }),
								"cursor-not-allowed opacity-50",
							)}
							type="button"
						>
							Delete group
						</button>
					</TooltipTrigger>
					<TooltipContent>
						Move this group's people to another group first.
					</TooltipContent>
				</Tooltip>
			) : (
				<Button
					disabled={disabled}
					onClick={() => setOpen(true)}
					size="sm"
					variant="destructive"
				>
					Delete group
				</Button>
			)}

			<AlertDialog onOpenChange={setOpen} open={open}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {groupName}?</AlertDialogTitle>
						<AlertDialogDescription>
							This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								onConfirm();
								setOpen(false);
							}}
							variant="destructive"
						>
							Delete group
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function GroupEditor({
	group,
	onDirtyChange,
	onDraftChange,
	onCreated,
	onDeleted,
	onCancelNew,
}: {
	group: AccessGroupRow | null;
	onDirtyChange: (dirty: boolean) => void;
	onDraftChange: (draft: GroupDraft) => void;
	onCreated: (id: string) => void;
	onDeleted: () => void;
	onCancelNew: () => void;
}) {
	const original = group ? draftFromRow(group) : null;
	const [draft, dispatch] = useReducer(
		groupEditorReducer,
		original ?? blankDraft(),
	);

	const trpc = useTRPC();
	const cache = useCrmCache();

	const dirty = original ? !sameDraft(draft, original) : true;

	useEffect(() => {
		onDirtyChange(dirty);
	}, [dirty, onDirtyChange]);

	useEffect(() => {
		onDraftChange(draft);
	}, [draft, onDraftChange]);

	const members = useQuery(
		trpc.workspace.members.queryOptions({ pageSize: 100 }),
	);
	const memberNames = draft.id
		? (members.data?.rows ?? [])
				.filter((row) => row.groupId === draft.id)
				.map((row) => firstName(row.name))
		: [];
	const memberCount = group?.memberCount ?? 0;

	const create = useMutation(
		trpc.accessGroups.create.mutationOptions({
			onSuccess: async (result) => {
				await cache.accessGroups();
				toast.success("Saved. 0 people updated.");
				onCreated(result.id);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const update = useMutation(
		trpc.accessGroups.update.mutationOptions({
			onSuccess: async (result) => {
				await cache.accessGroups();
				toast.success(
					`Saved. ${pluralize(result.affected, "person", "people")} updated.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.accessGroups.delete.mutationOptions({
			onSuccess: async () => {
				await cache.accessGroups();
				toast.success("Group deleted.");
				onDeleted();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const nameId = useId();
	const scopeId = useId();

	const field = draft.surface === "FIELD";
	const pending = create.isPending || update.isPending || remove.isPending;

	const handleSave = () => {
		if (draft.id) {
			update.mutate({
				id: draft.id,
				name: draft.name,
				surface: draft.surface,
				scope: draft.scope,
				policy: draft.policy,
			});
		} else {
			create.mutate({
				name: draft.name,
				surface: draft.surface,
				scope: draft.scope,
				policy: draft.policy,
			});
		}
	};

	const handleDiscard = () => {
		if (original) {
			dispatch({ type: "reset", draft: original });
		} else {
			onCancelNew();
		}
	};

	return (
		<div className="flex min-w-0 flex-col gap-6">
			<div className="flex items-center justify-end">
				{draft.id ? (
					<DeleteGroupButton
						groupName={draft.name}
						memberCount={memberCount}
						onConfirm={() => draft.id && remove.mutate({ id: draft.id })}
						pending={pending}
					/>
				) : null}
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={nameId}>Group name</FieldLabel>
					<Input
						id={nameId}
						onChange={(event) =>
							dispatch({ type: "setName", name: event.target.value })
						}
						value={draft.name}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={scopeId}>Which records</FieldLabel>
					<Select
						onValueChange={(value) =>
							dispatch({ type: "setScope", scope: value as AccessScope })
						}
						value={draft.scope}
					>
						<SelectTrigger className="w-full" id={scopeId}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ACCESS.scopes.map((scope) => (
								<SelectItem key={scope} value={scope}>
									{SCOPE_LABEL[scope]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>

			<Field>
				<FieldTitle>Where they work</FieldTitle>
				<ToggleGroup
					aria-label="Where they work"
					onValueChange={(value) => {
						if (value) {
							dispatch({
								type: "setSurface",
								surface: value as AccessSurface,
							});
						}
					}}
					type="single"
					value={draft.surface}
					variant="outline"
				>
					<ToggleGroupItem value="FULL">Full app</ToggleGroupItem>
					<ToggleGroupItem value="FIELD">Field mode only</ToggleGroupItem>
				</ToggleGroup>
				<FieldDescription>
					{field
						? "Every page outside Field sends them back to Field. No Janus chat."
						: "They use the normal app. Only the areas below appear."}
				</FieldDescription>
			</Field>

			<div className="flex flex-col gap-2">
				<FieldTitle>Areas</FieldTitle>
				<FieldDescription>
					Each level includes the ones before it.
				</FieldDescription>
				<SimpleTable
					columns={[
						{ id: "area", header: "Area" },
						{ id: "access", header: "Access" },
					]}
					variant="panel"
				>
					{ACCESS.areas.map((area) => {
						const disallowed = ACCESS.viewOnlyAreas.includes(area);
						return (
							<SimpleTableRow key={area}>
								<TableCell className="font-medium">{areaLabel(area)}</TableCell>
								<TableCell>
									<ToggleGroup
										aria-label={`${areaLabel(area)} access`}
										onValueChange={(value) => {
											if (value) {
												dispatch({
													type: "setLevel",
													area,
													level: value as AccessLevel,
												});
											}
										}}
										size="sm"
										type="single"
										value={draft.policy.areas[area]}
										variant="outline"
									>
										{ACCESS.levels.map((level) => (
											<ToggleGroupItem
												disabled={
													disallowed && (level === "EDIT" || level === "DELETE")
												}
												key={level}
												value={level}
											>
												{LEVEL_LABEL[level]}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</TableCell>
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			</div>

			<FieldGroup>
				<FieldTitle>On-site actions</FieldTitle>
				<FieldDescription>
					Work without seeing the list. Still limited to their records.
				</FieldDescription>
				{ACCESS.actions.map((action) => {
					const id = `action-${action}`;
					return (
						<FieldLabel htmlFor={id} key={action}>
							<Field orientation="horizontal">
								<Checkbox
									checked={draft.policy.actions.includes(action)}
									id={id}
									onCheckedChange={() =>
										dispatch({ type: "toggleAction", action })
									}
								/>
								<FieldContent>
									<FieldTitle>{ACTION_LABEL[action]}</FieldTitle>
									<FieldDescription>{ACTION_HINT[action]}</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					);
				})}
			</FieldGroup>

			<FieldGroup>
				<FieldTitle>Money</FieldTitle>
				<FieldDescription>
					Without these, money shows as Hidden.
				</FieldDescription>
				{ACCESS.money.map((money) => {
					const id = `money-${money}`;
					return (
						<FieldLabel htmlFor={id} key={money}>
							<Field orientation="horizontal">
								<Checkbox
									checked={draft.policy.money.includes(money)}
									id={id}
									onCheckedChange={() =>
										dispatch({ type: "toggleMoney", money })
									}
								/>
								<FieldContent>
									<FieldTitle>{MONEY_LABEL[money]}</FieldTitle>
									<FieldDescription>{MONEY_HINT[money]}</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					);
				})}
			</FieldGroup>

			{field && draft.scope === "ALL" ? (
				<Alert variant="warning">
					<AlertDescription>
						Field mode with All records shows every job on a tech's phone.
						Assigned only is usual.
					</AlertDescription>
				</Alert>
			) : null}

			<SaveBar
				open={dirty}
				title={`Changes access for ${pluralize(
					memberNames.length,
					"person",
					"people",
				)}: ${memberNames.length ? memberNames.join(", ") : "nobody yet"}`}
			>
				<Button
					disabled={pending}
					onClick={handleDiscard}
					size="sm"
					variant="outline"
				>
					Discard
				</Button>
				<Button disabled={pending} onClick={handleSave} size="sm">
					Save
				</Button>
			</SaveBar>
		</div>
	);
}

export function GroupBadge({ surface }: { surface: AccessSurface }) {
	return (
		<Badge variant={surface === "FIELD" ? "default" : "outline"}>
			{surface === "FIELD" ? "Field" : "Full app"}
		</Badge>
	);
}

export function GroupPreview({ draft }: { draft: GroupDraft }) {
	const field = draft.surface === "FIELD";

	return (
		<Card className="sticky top-4">
			<CardContent className="flex flex-col gap-3 pt-6">
				<FieldTitle>What {draft.name || "this group"} sees</FieldTitle>
				{field ? (
					<FieldDescription>
						Only the Field screen. No Janus chat.
					</FieldDescription>
				) : (
					<ul className="flex flex-col gap-1 text-xs">
						{ACCESS.areas.map((area) => {
							const level = draft.policy.areas[area];
							const off = level === "HIDDEN";
							return (
								<li
									className={
										off
											? "text-muted-foreground line-through"
											: "text-foreground"
									}
									key={area}
								>
									{areaLabel(area)}
									{off ? null : (
										<span className="text-muted-foreground">
											{" "}
											· {LEVEL_LABEL[level]}
										</span>
									)}
								</li>
							);
						})}
					</ul>
				)}
				<FieldDescription>
					{draft.policy.money.includes("profit")
						? "Profit visible."
						: "Profit hidden."}{" "}
					{draft.policy.money.includes("prices")
						? "Prices visible."
						: "Prices hidden."}
				</FieldDescription>
			</CardContent>
		</Card>
	);
}

export { SCOPE_LABEL };
