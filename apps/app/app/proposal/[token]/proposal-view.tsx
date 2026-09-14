"use client";

import { Button } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type PublicProposal = RouterOutputs["proposalView"]["byToken"];
type Tier = PublicProposal["defaultTier"];

const TIER_ORDER: Tier[] = ["GOOD", "BETTER", "BEST"];
const TIER_LABEL: Record<Tier, string> = {
	GOOD: "Good",
	BETTER: "Better",
	BEST: "Best",
};
const TIER_PRICE_FIELD: Record<
	Tier,
	"priceGoodCents" | "priceBetterCents" | "priceBestCents"
> = {
	GOOD: "priceGoodCents",
	BETTER: "priceBetterCents",
	BEST: "priceBestCents",
};

export function ProposalView({
	token,
	proposal,
}: {
	token: string;
	proposal: PublicProposal;
}) {
	const trpc = useTRPC();
	const nameId = useId();
	const noteId = useId();
	const [tier, setTier] = useState<Tier>(proposal.defaultTier);
	const [name, setName] = useState("");
	const [accepted, setAccepted] = useState(false);
	const [declining, setDeclining] = useState(false);
	const [declineNote, setDeclineNote] = useState("");
	const [declined, setDeclined] = useState(false);

	const accept = useMutation(
		trpc.proposalView.accept.mutationOptions({
			onSuccess: () => setAccepted(true),
			onError: (error) => toast.error(error.message),
		}),
	);

	const decline = useMutation(
		trpc.proposalView.decline.mutationOptions({
			onSuccess: () => setDeclined(true),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (declined) {
		return (
			<Card>
				<CardContent className="flex flex-col gap-2 py-10 text-center">
					<p className="font-medium text-lg">Thanks for letting us know.</p>
					<p className="text-muted-foreground text-sm/5">
						{proposal.businessName} has been notified. If anything changes, just
						reply to the email you received.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (accepted) {
		return (
			<Card>
				<CardContent className="flex flex-col gap-2 py-10 text-center">
					<p className="font-medium text-lg">
						Thank you. Your choice is locked in.
					</p>
					<p className="text-muted-foreground text-sm/5">
						You picked the {TIER_LABEL[tier]} option. {proposal.businessName}{" "}
						will reach out shortly with the agreement.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card>
				<CardContent className="flex flex-col gap-6 py-8">
					<div className="flex flex-col gap-1">
						<h1 className="font-semibold text-2xl">
							{proposal.coverTitle?.trim() || proposal.title}
						</h1>
						{proposal.coverSubtitle ? (
							<p className="text-muted-foreground text-sm/6">
								{proposal.coverSubtitle}
							</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							{[
								proposal.contactName
									? `Prepared for ${proposal.contactName}`
									: null,
								`Proposal #${proposal.number}`,
							]
								.filter(Boolean)
								.join(" · ")}
						</p>
					</div>

					<iframe
						title="Proposal"
						sandbox=""
						srcDoc={proposal.bodyHtml}
						className="min-h-64 w-full rounded-lg border bg-white"
					/>
				</CardContent>
			</Card>

			{proposal.photoIds.length > 0 ? (
				<Card>
					<CardContent className="flex flex-col gap-3 py-6">
						<p className="font-medium text-sm">Photos from your job</p>
						<div className="grid grid-cols-2 gap-3">
							{proposal.photoIds.map((photoId) => (
								// biome-ignore lint/performance/noImgElement: public page has no next/image loader for token routes
								<img
									key={photoId}
									src={`/api/proposal-photos/${token}/${photoId}`}
									alt="From your job site"
									className="w-full rounded-lg border object-cover"
								/>
							))}
						</div>
					</CardContent>
				</Card>
			) : null}

			<Card>
				<CardContent className="flex flex-col gap-5 py-8">
					<div className="flex flex-col gap-1">
						<p className="font-medium text-base">Pick your option</p>
						<p className="text-muted-foreground text-sm/5">
							Every option covers the full scope below. The difference is
							materials and warranty.
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						{TIER_ORDER.map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => setTier(option)}
								aria-pressed={tier === option}
								className={cn(
									"flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors",
									tier === option
										? "border-primary ring-2 ring-primary/30"
										: "border-border hover:border-primary/40",
								)}
							>
								<span className="text-muted-foreground text-xs">
									{TIER_LABEL[option]}
								</span>
								<span className="font-semibold text-lg tabular-nums">
									{formatMoney(proposal.totals[option], proposal.currency)}
								</span>
							</button>
						))}
					</div>

					<div className="flex flex-col gap-1">
						{proposal.lineItems.map((item, index) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: read-only list, never reordered
								key={`${item.name}-${index}`}
								className="flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-b-0"
							>
								<span>{item.name}</span>
								<span className="flex shrink-0 items-baseline gap-3">
									<span className="text-muted-foreground text-xs tabular-nums">
										{item.quantity}
									</span>
									<span className="w-24 text-right text-sm tabular-nums">
										{formatMoney(
											Math.round(item.quantity * item[TIER_PRICE_FIELD[tier]]),
											proposal.currency,
										)}
									</span>
								</span>
							</div>
						))}
					</div>

					<div className="flex flex-col gap-4 border-t pt-5">
						<Field>
							<FieldLabel htmlFor={nameId}>Your full name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoComplete="name"
								placeholder="Type your name to accept"
							/>
						</Field>
						<Button
							size="lg"
							disabled={accept.isPending || name.trim().length === 0}
							onClick={() => accept.mutate({ token, tier, name: name.trim() })}
						>
							{accept.isPending ? <Spinner data-icon="inline-start" /> : null}
							Accept the {TIER_LABEL[tier]} option
						</Button>
						<p className="text-center text-muted-foreground text-xs">
							Accepting locks in your choice and lets {proposal.businessName}{" "}
							prepare the agreement. Nothing is charged today.
						</p>

						{declining ? (
							<div className="flex flex-col gap-3 border-t pt-4">
								<Field>
									<FieldLabel htmlFor={noteId}>
										Anything you want to tell us? (optional)
									</FieldLabel>
									<Textarea
										id={noteId}
										rows={3}
										value={declineNote}
										onChange={(event) => setDeclineNote(event.target.value)}
									/>
								</Field>
								<div className="flex items-center justify-end gap-2">
									<Button variant="ghost" onClick={() => setDeclining(false)}>
										Back
									</Button>
									<Button
										variant="outline"
										disabled={decline.isPending || name.trim().length === 0}
										onClick={() =>
											decline.mutate({
												token,
												name: name.trim(),
												note: declineNote.trim() || undefined,
											})
										}
									>
										{decline.isPending ? (
											<Spinner data-icon="inline-start" />
										) : null}
										Decline this proposal
									</Button>
								</div>
								{name.trim().length === 0 ? (
									<p className="text-right text-muted-foreground text-xs">
										Enter your name above first.
									</p>
								) : null}
							</div>
						) : (
							<button
								type="button"
								onClick={() => setDeclining(true)}
								className="self-center text-muted-foreground text-xs underline-offset-2 hover:underline"
							>
								Not the right fit? Decline this proposal
							</button>
						)}
					</div>
				</CardContent>
			</Card>
		</>
	);
}
