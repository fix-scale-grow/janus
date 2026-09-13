"use client";

import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const PROFIT_VIEW_KEY = "profit.view" as const;

type MemberRow = RouterOutputs["workspace"]["members"]["rows"][number];

type PermissionRow = RouterOutputs["permissions"]["listUsers"][number];

function withKey(
	rows: PermissionRow[] | undefined,
	userId: string,
	granted: boolean,
): PermissionRow[] | undefined {
	return rows?.map((row) => {
		if (row.userId !== userId) return row;
		return {
			...row,
			keys: granted
				? [
						...row.keys.filter((key) => key !== PROFIT_VIEW_KEY),
						PROFIT_VIEW_KEY,
					]
				: row.keys.filter((key) => key !== PROFIT_VIEW_KEY),
		};
	});
}

function columns(
	canChangeRoles: boolean,
	onChangeRole: (member: MemberRow, role: Role) => void,
	pending: boolean,
	profit: {
		viewerIsAdmin: boolean;
		permissionsByUserId: Map<string, PermissionRow>;
		pending: boolean;
		onToggle: (userId: string, next: boolean) => void;
	},
): DataTableColumn<MemberRow>[] {
	const base: DataTableColumn<MemberRow>[] = [
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
			width: "w-[32%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.email}</span>
			),
		},
		{
			id: "role",
			header: "Role",
			sortable: true,
			width: "w-[14%]",
			cell: (row) => (
				<span className="text-muted-foreground">{ROLE_LABEL[row.role]}</span>
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
			id: "actions",
			header: <span className="sr-only">Actions</span>,
			label: "Actions",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) =>
				canChangeRoles ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" disabled={pending}>
								<Icon icon={OverflowMenuHorizontal} />
								<span className="sr-only">Change {row.name}'s role</span>
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							{(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
								<DropdownMenuItem
									key={role}
									data-checked={row.role === role}
									onSelect={() => {
										if (row.role === role) return;
										onChangeRole(row, role);
									}}
								>
									{ROLE_LABEL[role]}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
		},
	];

	if (!profit.viewerIsAdmin) return base;

	const profitColumn: DataTableColumn<MemberRow> = {
		id: "profitView",
		header: "Can view profit",
		label: "Can view profit",
		hideable: false,
		width: "w-[14%]",
		cell: (row) => {
			if (row.role === "admin" || row.role === "owner") {
				return <span className="text-muted-foreground">Admin — always</span>;
			}
			const permissionRow = profit.permissionsByUserId.get(row.userId);
			const checked = permissionRow?.keys.includes(PROFIT_VIEW_KEY) ?? false;
			return (
				<Switch
					checked={checked}
					disabled={profit.pending}
					onCheckedChange={(next) => profit.onToggle(row.userId, next)}
				/>
			);
		},
	};

	return [...base.slice(0, 3), profitColumn, ...base.slice(3)];
}

export function MembersTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const { query, input } = useTableQuery(membersSearchParams);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const viewerIsAdmin =
		workspace.data?.viewerRole === "admin" ||
		workspace.data?.viewerRole === "owner";

	const permissions = useQuery({
		...trpc.permissions.listUsers.queryOptions(),
		enabled: viewerIsAdmin,
	});

	const permissionsByUserId = new Map(
		(permissions.data ?? []).map((row) => [row.userId, row]),
	);

	const setRole = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Role changed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const permissionsKey = trpc.permissions.listUsers.queryKey();
	const mineKey = trpc.permissions.mine.queryKey();

	const settlePermissions = () => {
		queryClient.invalidateQueries({ queryKey: permissionsKey });
		queryClient.invalidateQueries({ queryKey: mineKey });
	};

	const grant = useMutation(
		trpc.permissions.grant.mutationOptions({
			onMutate: async ({ userId }) => {
				await queryClient.cancelQueries({ queryKey: permissionsKey });
				const previous =
					queryClient.getQueryData<PermissionRow[]>(permissionsKey);
				queryClient.setQueryData(
					permissionsKey,
					(rows: PermissionRow[] | undefined) => withKey(rows, userId, true),
				);
				return { previous };
			},
			onError: (error, _variables, context) => {
				if (context?.previous) {
					queryClient.setQueryData(permissionsKey, context.previous);
				}
				toast.error(error.message);
			},
			onSettled: settlePermissions,
		}),
	);

	const revoke = useMutation(
		trpc.permissions.revoke.mutationOptions({
			onMutate: async ({ userId }) => {
				await queryClient.cancelQueries({ queryKey: permissionsKey });
				const previous =
					queryClient.getQueryData<PermissionRow[]>(permissionsKey);
				queryClient.setQueryData(
					permissionsKey,
					(rows: PermissionRow[] | undefined) => withKey(rows, userId, false),
				);
				return { previous };
			},
			onError: (error, _variables, context) => {
				if (context?.previous) {
					queryClient.setQueryData(permissionsKey, context.previous);
				}
				toast.error(error.message);
			},
			onSettled: settlePermissions,
		}),
	);

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
			{viewerIsAdmin ? (
				<p className="text-muted-foreground text-xs">
					Per-user access controls will grow here.
				</p>
			) : null}

			<DataTable
				query={query}
				search={<ListSearch placeholder="Search by name or email…" />}
				columns={columns(
					workspace.data?.canChangeRoles ?? false,
					(member, role) => setRole.mutate({ memberId: member.id, role }),
					setRole.isPending,
					{
						viewerIsAdmin,
						permissionsByUserId,
						pending: grant.isPending || revoke.isPending,
						onToggle: (userId, next) => {
							if (next) {
								grant.mutate({ userId, key: PROFIT_VIEW_KEY });
							} else {
								revoke.mutate({ userId, key: PROFIT_VIEW_KEY });
							}
						},
					},
				)}
				rows={members.data?.rows ?? []}
				total={members.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				getRowId={(row) => row.id}
				loading={members.isFetching}
				empty="Nobody matches this view."
			/>
		</div>
	);
}
