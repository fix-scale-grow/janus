"use client";

import {
	AsyncButtonContent,
	useAsyncAction,
} from "@crm/ui/components/async-action";
import { Button } from "@crm/ui/components/button";
import { approvalCopyFor } from "@/lib/agent-approval-copy";
import type { TranscriptItem } from "@/lib/agent-transcript";

export type ApprovalResponse = {
	requestId: string;
	optionId: "approve" | "deny";
};

export function AgentApprovalCard({
	item,
	onRespond,
}: {
	item: Extract<TranscriptItem, { kind: "tool-approval" }>;
	onRespond: (response: ApprovalResponse) => Promise<void>;
}) {
	const copy = approvalCopyFor(item.toolName);
	const sections = copy.render(item.input);
	const settled = item.status !== "pending";

	const approve = useAsyncAction({
		action: () => onRespond({ requestId: item.requestId, optionId: "approve" }),
	});
	const deny = useAsyncAction({
		action: () => onRespond({ requestId: item.requestId, optionId: "deny" }),
	});
	const busy = approve.pending || deny.pending;

	const outcome =
		item.status === "approved"
			? (copy.outcome?.(item.output) ?? "Approved")
			: item.status === "denied"
				? "Declined"
				: null;

	return (
		<div className="w-full max-w-sm space-y-3 rounded-lg border bg-card p-3">
			<div className="space-y-1">
				<p className="font-medium text-xs">{copy.title}</p>
				{outcome ? (
					<p className="text-pretty text-muted-foreground text-xs">{outcome}</p>
				) : null}
			</div>

			{!settled && sections.some((section) => section.rows.length > 0) ? (
				<div className="space-y-2">
					{sections.map((section) => (
						<div
							key={
								section.title ?? section.rows.map((row) => row.label).join("|")
							}
							className="space-y-1"
						>
							{section.title ? (
								<p className="font-medium text-muted-foreground text-xs">
									{section.title}
								</p>
							) : null}
							<div className="space-y-1">
								{section.rows.map((row) => (
									<div
										key={row.label}
										className="flex items-baseline justify-between gap-3 text-xs"
									>
										<span className="text-muted-foreground">{row.label}</span>
										<span className="wrap-break-word text-right">
											{row.value}
										</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			) : null}

			{item.status === "pending" ? (
				<div className="flex items-center gap-2">
					<Button
						variant="default"
						size="sm"
						disabled={busy}
						onClick={() => void approve.run()}
					>
						<AsyncButtonContent
							status={approve.status}
							pendingLabel="Approving"
						>
							Approve
						</AsyncButtonContent>
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={busy}
						onClick={() => void deny.run()}
					>
						<AsyncButtonContent status={deny.status} pendingLabel="Denying">
							Deny
						</AsyncButtonContent>
					</Button>
				</div>
			) : null}
		</div>
	);
}
