"use client";

import type {
	AccessArea,
	AccessLevel,
	AccessScope,
	AccessSurface,
} from "@crm/db/access-config";
import { ACCESS } from "@crm/db/access-config";
import type { AccessPolicy } from "@crm/db/access-policy";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
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
import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useReducer } from "react";
import { toast } from "sonner";
import { type MyAccess, visibleModules } from "@/lib/access-rules";
import { JANUS_LIVE_NAV } from "@/lib/janus-nav";
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

function sameDraft(a: GroupDraft, b: GroupDraft): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function GroupEditor({
	group,
	onDirtyChange,
	onCreated,
	onDeleted,
	onCancelNew,
}: {
	group: AccessGroupRow | null;
	onDirtyChange: (dirty: boolean) => void;
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

	const memberCount = group?.memberCount ?? 0;

	const draftMine: MyAccess = {
		isAdmin: false,
		groupId: draft.id,
		groupName: draft.name,
		surface: draft.surface,
		scope: draft.scope,
		areas: draft.policy.areas,
		actions: draft.policy.actions,
		money: draft.policy.money,
	};
	const previewModules = visibleModules(JANUS_LIVE_NAV, draftMine);

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
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={nameId}>Group name</FieldLabel>
					<Input
						id={nameId}
						value={draft.name}
						onChange={(event) =>
							dispatch({ type: "setName", name: event.target.value })
						}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={scopeId}>Which records</FieldLabel>
					<Select
						value={draft.scope}
						onValueChange={(value) =>
							dispatch({ type: "setScope", scope: value as AccessScope })
						}
					>
						<SelectTrigger id={scopeId} className="w-full">
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
					type="single"
					variant="outline"
					value={draft.surface}
					onValueChange={(value) => {
						if (value) {
							dispatch({
								type: "setSurface",
								surface: value as AccessSurface,
							});
						}
					}}
					aria-label="Where they work"
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
					variant="panel"
					columns={[
						{ id: "area", header: "Area" },
						{ id: "access", header: "Access" },
					]}
				>
					{ACCESS.areas.map((area) => {
						const disallowed = ACCESS.viewOnlyAreas.includes(area);
						return (
							<SimpleTableRow key={area}>
								<TableCell className="font-medium">{areaLabel(area)}</TableCell>
								<TableCell>
									<ToggleGroup
										type="single"
										variant="outline"
										size="sm"
										value={draft.policy.areas[area]}
										onValueChange={(value) => {
											if (value) {
												dispatch({
													type: "setLevel",
													area,
													level: value as AccessLevel,
												});
											}
										}}
										aria-label={`${areaLabel(area)} access`}
									>
										{ACCESS.levels.map((level) => (
											<ToggleGroupItem
												key={level}
												value={level}
												disabled={
													disallowed && (level === "EDIT" || level === "DELETE")
												}
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
						<FieldLabel key={action} htmlFor={id}>
							<Field orientation="horizontal">
								<Checkbox
									id={id}
									checked={draft.policy.actions.includes(action)}
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
						<FieldLabel key={money} htmlFor={id}>
							<Field orientation="horizontal">
								<Checkbox
									id={id}
									checked={draft.policy.money.includes(money)}
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
				<div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning text-xs">
					Field mode with All records shows every job on a tech's phone.
					Assigned only is usual.
				</div>
			) : null}

			<div className="flex flex-col gap-2 rounded-lg border p-3">
				<FieldTitle>What {draft.name || "this group"} sees</FieldTitle>
				<ul className="flex flex-col gap-1 text-xs">
					{previewModules.map((module) => (
						<li className="text-foreground" key={module.href}>
							{module.title}
						</li>
					))}
				</ul>
				<FieldDescription>
					{draft.policy.money.includes("profit")
						? "Profit visible."
						: "Profit hidden."}{" "}
					{draft.policy.money.includes("prices")
						? "Prices visible."
						: "Prices hidden."}
				</FieldDescription>
			</div>

			<SaveBar
				open
				title={
					dirty
						? `Changes access for ${pluralize(memberCount, "person", "people")}`
						: "No unsaved changes"
				}
			>
				{draft.id ? (
					memberCount > 0 ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button disabled size="sm" variant="destructive">
									Delete group
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								Move this group's people to another group first.
							</TooltipContent>
						</Tooltip>
					) : (
						<Button
							disabled={pending}
							onClick={() => draft.id && remove.mutate({ id: draft.id })}
							size="sm"
							variant="destructive"
						>
							Delete group
						</Button>
					)
				) : null}
				<Button
					disabled={pending || !dirty}
					onClick={handleDiscard}
					size="sm"
					variant="outline"
				>
					Discard
				</Button>
				<Button disabled={pending || !dirty} onClick={handleSave} size="sm">
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

export { SCOPE_LABEL };
