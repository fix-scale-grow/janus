"use client";

import Add from "@carbon/icons-react/es/Add";
import Renew from "@carbon/icons-react/es/Renew";
import Warning from "@carbon/icons-react/es/Warning";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LocalRelativeDate } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { FormEditor } from "./form-editor";
import {
	EMPTY_BODY,
	EMPTY_TITLE,
	ERROR_BODY,
	ERROR_TITLE,
	NEW_FORM,
	NEW_FORM_EMAIL_LABEL,
	NEW_FORM_NAME,
	PAGE_DESCRIPTION,
	PAGE_TITLE,
	RETRY,
	submissionCountNote,
} from "./forms-copy";

type FormRow = RouterOutputs["forms"]["list"]["rows"][number];

const LIST_INPUT = {
	q: "",
	sort: "updatedAt",
	dir: "desc" as const,
	page: 1,
	pageSize: 100,
};

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "submissions", header: "Submissions", width: "w-32", align: "right" },
	{ id: "updated", header: "Updated", width: "w-40" },
	{ id: "active", header: "Active", width: "w-16", align: "center" },
];

const CELL = "px-3 py-2.5 align-middle";

export function FormsSettings() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [editingId, setEditingId] = useState<string | null>(null);

	const forms = useQuery(trpc.forms.list.queryOptions(LIST_INPUT));

	const create = useMutation(
		trpc.forms.create.mutationOptions({
			onSuccess: async (form) => {
				await cache.forms();
				setEditingId(form.id);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const toggleActive = useMutation(
		trpc.forms.setActive.mutationOptions({
			onSuccess: (form) => cache.forms(form.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (editingId) {
		return <FormEditor formId={editingId} onBack={() => setEditingId(null)} />;
	}

	if (forms.isPending) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{PAGE_TITLE}</CardTitle>
					<CardDescription>{PAGE_DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardTableEmpty>
					<Spinner data-icon="inline-start" />
					Loading forms…
				</CardTableEmpty>
			</Card>
		);
	}

	if (forms.isError) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={Warning} />
					</EmptyMedia>
					<EmptyTitle>{ERROR_TITLE}</EmptyTitle>
					<EmptyDescription>{ERROR_BODY}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						variant="outline"
						disabled={forms.isFetching}
						onClick={() => forms.refetch()}
					>
						<Icon icon={Renew} data-icon="inline-start" />
						{RETRY}
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	const rows = forms.data?.rows ?? [];

	const createForm = () =>
		create.mutate({
			name: NEW_FORM_NAME,
			fields: [{ type: "EMAIL", label: NEW_FORM_EMAIL_LABEL, required: true }],
		});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{PAGE_TITLE}</CardTitle>
				<CardDescription>{PAGE_DESCRIPTION}</CardDescription>
				<CardAction>
					<Button size="sm" disabled={create.isPending} onClick={createForm}>
						<Icon icon={Add} data-icon="inline-start" />
						{NEW_FORM}
					</Button>
				</CardAction>
			</CardHeader>

			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Add} />
						</EmptyMedia>
						<EmptyTitle>{EMPTY_TITLE}</EmptyTitle>
						<EmptyDescription>{EMPTY_BODY}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button disabled={create.isPending} onClick={createForm}>
							<Icon icon={Add} data-icon="inline-start" />
							{NEW_FORM}
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row: FormRow) => (
						<SimpleTableRow
							key={row.id}
							clickable
							onClick={() => setEditingId(row.id)}
						>
							<TableCell className={`${CELL} font-medium`}>
								{row.name}
							</TableCell>
							<TableCell className={`${CELL} text-right text-muted-foreground`}>
								{submissionCountNote(row.submissionCount)}
							</TableCell>
							<TableCell className={`${CELL} text-muted-foreground`}>
								<LocalRelativeDate date={row.updatedAt} />
							</TableCell>
							<TableCell className={`${CELL} text-center`}>
								<Switch
									checked={row.active}
									disabled={toggleActive.isPending}
									onClick={(event) => event.stopPropagation()}
									onCheckedChange={(active) =>
										toggleActive.mutate({ id: row.id, active })
									}
								/>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}
		</Card>
	);
}
