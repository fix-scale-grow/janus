"use client";

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

function accessValue(row: MemberRow): string {
	if (row.role === "admin") return ADMIN_VALUE;
	return row.groupId ?? "";
}

function firstName(name: string): string {
	return name.split(" ")[0] ?? name;
}

function columns(
	groups: AccessGroupRow[],
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
					return <Badge variant="outline">Owner</Badge>;
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

	const groups = useQuery(trpc.accessGroups.list.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});

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
					(member, value) =>
						setAccess.mutate({
							memberId: member.id,
							access:
								value === ADMIN_VALUE
									? { kind: "admin" }
									: { kind: "group", groupId: value },
						}),
					setAccess.isPending,
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
