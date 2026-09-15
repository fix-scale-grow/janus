"use client";

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
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { membersSearchParams } from "./members-search-params";

const ROLE_LABEL = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
} as const;

type Role = keyof typeof ROLE_LABEL;

type MemberRow = RouterOutputs["workspace"]["members"]["rows"][number];
type AccessGroupRow = RouterOutputs["accessGroups"]["list"][number];

const ADMIN_VALUE = "admin";
const OWNER_VALUE = "owner";

function accessValue(row: MemberRow): string {
	if (row.role === "admin") return ADMIN_VALUE;
	return row.groupId ?? "";
}

function firstName(name: string): string {
	return name.split(" ")[0] ?? name;
}

function columns(
	groups: AccessGroupRow[],
	canChangeRoles: boolean,
	onChangeAccess: (member: MemberRow, value: string) => void,
	pending: boolean,
): DataTableColumn<MemberRow>[] {
	return [
		{
			id: "name",
			header: "Name",
			sortable: true,
			hideable: false,
			width: "w-[34%]",
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-2">
					<PersonAvatar
						size="sm"
						src={row.image}
						name={row.name}
						email={row.email}
					/>
					<span className="truncate font-medium">{row.name}</span>
					{row.isViewer ? (
						<span className="text-muted-foreground text-xs">You</span>
					) : null}
				</span>
			),
		},
		{
			id: "email",
			header: "Email",
			sortable: true,
			width: "w-[28%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.email}</span>
			),
		},
		{
			id: "joinedAt",
			header: "Joined",
			label: "Joined date",
			sortable: true,
			align: "right",
			width: "w-[14%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.joinedAt} />
				</span>
			),
		},
		{
			id: "access",
			header: "Access",
			label: "Access",
			hideable: false,
			width: "w-[24%]",
			cell: (row) => {
				if (row.role === "owner") {
					return (
						<Select
							disabled={pending || !canChangeRoles}
							onValueChange={(value) => onChangeAccess(row, value)}
							value={OWNER_VALUE}
						>
							<SelectTrigger aria-label={`Access for ${row.name}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={OWNER_VALUE}>Owner</SelectItem>
								<SelectItem value={ADMIN_VALUE}>Admin</SelectItem>
							</SelectContent>
						</Select>
					);
				}

				const ungrouped = row.role === "member" && !row.groupId;

				return (
					<span className="flex items-center gap-2">
						<Select
							disabled={pending}
							onValueChange={(value) => onChangeAccess(row, value)}
							value={accessValue(row)}
						>
							<SelectTrigger aria-label={`Access for ${row.name}`}>
								<SelectValue placeholder="Choose a group" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ADMIN_VALUE}>Admin</SelectItem>
								<SelectItem disabled={!canChangeRoles} value={OWNER_VALUE}>
									Owner
								</SelectItem>
								<SelectGroup>
									<SelectLabel>Groups</SelectLabel>
									{groups.map((group) => (
										<SelectItem key={group.id} value={group.id}>
											{group.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						{ungrouped ? <Badge variant="warning">Needs a group</Badge> : null}
					</span>
				);
			},
		},
	];
}

export function MembersTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { query, input } = useTableQuery(membersSearchParams);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const groups = useQuery(trpc.accessGroups.list.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const [pendingOwner, setPendingOwner] = useState<{
		memberId: string;
		name: string;
	} | null>(null);

	const setAccess = useMutation(
		trpc.accessGroups.setMemberAccess.mutationOptions({
			onSuccess: async (_result, variables) => {
				await cache.accessGroups();
				const member = members.data?.rows.find(
					(row) => row.id === variables.memberId,
				);
				const name = member ? firstName(member.name) : "They";
				const access = variables.access;
				if (access.kind === "admin") {
					toast.success(`${name} is now an Admin.`);
					return;
				}
				const group = groups.data?.find((g) => g.id === access.groupId);
				toast.success(`${name} is now in ${group?.name ?? "the group"}.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setRole = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({
			onSuccess: async (result, variables) => {
				await Promise.all([cache.workspace(), cache.accessGroups()]);
				const name = firstName(result.name);
				toast.success(
					variables.role === "owner"
						? `${name} is now an owner.`
						: `${name} is now an Admin.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const pending = setAccess.isPending || setRole.isPending;

	const handleChangeAccess = (member: MemberRow, value: string) => {
		if (member.role === "owner") {
			if (value === ADMIN_VALUE) {
				setRole.mutate({ memberId: member.id, role: "admin" });
			}
			return;
		}

		if (value === OWNER_VALUE) {
			setPendingOwner({ memberId: member.id, name: firstName(member.name) });
			return;
		}

		if (value === ADMIN_VALUE) {
			setAccess.mutate({ memberId: member.id, access: { kind: "admin" } });
			return;
		}

		setAccess.mutate({
			memberId: member.id,
			access: { kind: "group", groupId: value },
		});
	};

	const facetCounts = members.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "role",
			label: "Role",
			options: (Object.keys(ROLE_LABEL) as Role[]).flatMap((role) =>
				(facetCounts?.role?.[role] ?? 0) > 0
					? [{ value: role, label: ROLE_LABEL[role] }]
					: [],
			),
		},
	];

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			<DataTable
				query={query}
				search={<ListSearch placeholder="Search by name or email…" />}
				columns={columns(
					groups.data ?? [],
					workspace.data?.canChangeRoles ?? false,
					handleChangeAccess,
					pending,
				)}
				rows={members.data?.rows ?? []}
				total={members.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				getRowId={(row) => row.id}
				loading={members.isFetching}
				empty="Nobody matches this view."
			/>

			<p className="text-muted-foreground text-xs">
				Admins see everything. Everyone else is in exactly one group.
			</p>

			<AlertDialog
				onOpenChange={(open) => {
					if (!open) setPendingOwner(null);
				}}
				open={pendingOwner !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Make {pendingOwner?.name} an owner?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Owners see and change everything, including billing and other
							owners.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingOwner) {
									setRole.mutate({
										memberId: pendingOwner.memberId,
										role: "owner",
									});
								}
								setPendingOwner(null);
							}}
						>
							Make owner
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
