"use client";

import Phone from "@carbon/icons-react/es/Phone";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { ProductionStageIndicator } from "@/components/crm/production-stage-change";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { dialHref } from "@/lib/dial";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type FieldJob = RouterOutputs["deals"]["fieldToday"][number];

function contactLabel(contact: FieldJob["contact"]): string | null {
	if (!contact) return null;
	const name = [contact.firstName, contact.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	return name.length > 0 ? name : null;
}

/**
 * Field Mode — the crew's mobile work list. Every won job currently on the shop
 * floor (scheduled / in progress / on hold), newest-moved first. Tap the card to
 * open the full job record; one tap on Call dials the customer directly. Built
 * mobile-first (single narrow column) because this is the on-site view.
 */
export function FieldCrew() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const { data: jobs = [] } = useQuery(trpc.deals.fieldToday.queryOptions());

	if (jobs.length === 0) {
		return (
			<div className="mx-auto max-w-md py-16 text-center">
				<p className="text-sm font-medium text-foreground">
					No jobs on the floor
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Won jobs show up here once they&apos;re scheduled or in progress.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto flex max-w-md flex-col gap-3 pb-10">
			<p className="text-sm text-muted-foreground">
				{jobs.length} active {jobs.length === 1 ? "job" : "jobs"}
			</p>
			{jobs.map((job) => {
				const name = contactLabel(job.contact);
				const phone = job.contact?.phone ?? null;
				return (
					<div
						key={job.id}
						className="rounded-2xl border border-border bg-card shadow-sm"
					>
						{/* Open-record region: a button wrapping only non-interactive
						 * content, so the Call anchor never nests inside it. */}
						<button
							type="button"
							onClick={() => openRecord({ kind: "deal", id: job.id })}
							className="block w-full rounded-t-2xl p-4 text-left active:scale-[0.99]"
						>
							<div className="flex items-center justify-between gap-2">
								<ProductionStageIndicator stage={job.productionStage} />
								<span className="text-sm font-semibold tabular-nums text-foreground">
									{job.amountCents === null
										? "—"
										: formatMoney(job.amountCents, job.currency)}
								</span>
							</div>
							<p className="mt-2 truncate text-base font-bold text-foreground">
								{job.name}
							</p>
							{job.company?.name && (
								<p className="truncate text-sm text-muted-foreground">
									{job.company.name}
								</p>
							)}
							{name && (
								<p className="mt-1 truncate text-sm text-foreground">{name}</p>
							)}
						</button>

						<div className="flex items-center gap-2 border-t border-border p-3">
							{phone ? (
								<Button asChild variant="outline" size="sm" className="flex-1">
									<a
										href={`tel:${dialHref(phone)}`}
										aria-label={name ? `Call ${name}` : "Call customer"}
									>
										<Icon icon={Phone} data-icon="inline-start" />
										Call
									</a>
								</Button>
							) : (
								<span className="px-1 text-xs text-muted-foreground">
									No phone on file
								</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
