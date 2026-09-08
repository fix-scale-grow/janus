"use client";

import DocumentBlank from "@carbon/icons-react/es/DocumentBlank";
import { formSubmissionAnswers } from "@crm/db/forms";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	Empty,
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
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LocalRelativeDate } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { SUBMISSIONS_EMPTY, statusLabel } from "./forms-copy";

type SubmissionRow = {
	id: string;
	fields: unknown;
	email: string | null;
	contactId: string | null;
	dealId: string | null;
	filedAt: string | null;
	skipReason: string | null;
	createdAt: string;
};

const LIST_INPUT = {
	q: "",
	sort: "",
	dir: "desc" as const,
	page: 1,
	pageSize: 25,
};

const COLUMNS: SimpleTableColumn[] = [
	{ id: "when", header: "When", width: "w-40" },
	{ id: "answers", header: "Answers" },
	{ id: "status", header: "Status", width: "w-24" },
	{ id: "contact", header: "Contact", width: "w-24" },
	{ id: "deal", header: "Deal", width: "w-24" },
];

const CELL = "px-3 py-2.5 align-middle";

function answersSummary(fields: unknown): string {
	const parsed = formSubmissionAnswers.safeParse(fields);
	if (!parsed.success) return "—";
	return parsed.data
		.filter((answer) => answer.value.trim() !== "")
		.map((answer) => `${answer.label}: ${answer.value}`)
		.join(" · ");
}

export function FormSubmissions({ formId }: { formId: string }) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();

	const submissions = useQuery(
		trpc.forms.submissions.queryOptions({ formId, listInput: LIST_INPUT }),
	);

	if (submissions.isPending) {
		return (
			<CardTableEmpty>
				<Spinner data-icon="inline-start" />
				Loading submissions…
			</CardTableEmpty>
		);
	}

	const rows = submissions.data?.rows ?? [];

	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={DocumentBlank} />
					</EmptyMedia>
					<EmptyTitle>{SUBMISSIONS_EMPTY}</EmptyTitle>
					<EmptyDescription>
						Submissions from the embed or the hosted link show up here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<SimpleTable columns={COLUMNS}>
			{rows.map((row: SubmissionRow) => (
				<SimpleTableRow key={row.id}>
					<TableCell className={`${CELL} text-muted-foreground`}>
						<LocalRelativeDate date={row.createdAt} />
					</TableCell>
					<TableCell className={`${CELL} truncate`}>
						{answersSummary(row.fields)}
					</TableCell>
					<TableCell className={CELL}>
						{statusLabel(row.filedAt, row.skipReason)}
					</TableCell>
					<TableCell className={CELL}>
						{row.contactId ? (
							<Link
								className="text-primary underline underline-offset-2"
								href={workspaceUrl(`/contacts/${row.contactId}`)}
							>
								View
							</Link>
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</TableCell>
					<TableCell className={CELL}>
						{row.dealId ? (
							<Link
								className="text-primary underline underline-offset-2"
								href={workspaceUrl(`/deals/${row.dealId}`)}
							>
								View
							</Link>
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}
