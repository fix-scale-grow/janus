import { Card, CardContent } from "@crm/ui/components/card";
import Logo from "@crm/ui/components/logo";
import { TRPCClientError } from "@trpc/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocalDay } from "@/components/local-date-time";
import { getServerTrpcClient } from "@/lib/trpc/server";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ProposalView } from "./proposal-view";

export const metadata: Metadata = { title: "Your proposal" };

type PublicProposal = RouterOutputs["proposalView"]["byToken"];

export default async function ProposalPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const client = getServerTrpcClient();

	let proposal: PublicProposal;
	try {
		proposal = await client.proposalView.byToken.query({ token });
	} catch (error) {
		if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
			notFound();
		}

		return (
			<ProposalShell>
				<MessageCard title="This proposal is no longer available." />
			</ProposalShell>
		);
	}

	if (proposal.status === "VOID") {
		return (
			<ProposalShell businessName={proposal.businessName}>
				<MessageCard title="This proposal is no longer available." />
			</ProposalShell>
		);
	}

	if (proposal.status === "ACCEPTED") {
		return (
			<ProposalShell businessName={proposal.businessName}>
				<MessageCard title="This proposal is accepted.">
					{proposal.acceptedName && proposal.acceptedAt ? (
						<p className="text-muted-foreground text-sm/5">
							Accepted by {proposal.acceptedName} on{" "}
							<LocalDay date={proposal.acceptedAt} />. {proposal.businessName}{" "}
							will be in touch about next steps.
						</p>
					) : null}
				</MessageCard>
			</ProposalShell>
		);
	}

	if (proposal.status === "DECLINED") {
		return (
			<ProposalShell businessName={proposal.businessName}>
				<MessageCard title="This proposal was declined.">
					{proposal.declinedName && proposal.declinedAt ? (
						<p className="text-muted-foreground text-sm/5">
							Declined by {proposal.declinedName} on{" "}
							<LocalDay date={proposal.declinedAt} />. Changed your mind? Ask{" "}
							{proposal.businessName} for a fresh proposal.
						</p>
					) : null}
				</MessageCard>
			</ProposalShell>
		);
	}

	if (proposal.expired) {
		return (
			<ProposalShell businessName={proposal.businessName}>
				<MessageCard
					title="This proposal link has expired"
					description={`Ask ${proposal.businessName} to send a new one.`}
				/>
			</ProposalShell>
		);
	}

	return (
		<ProposalShell businessName={proposal.businessName} wide>
			<ProposalView token={token} proposal={proposal} />
		</ProposalShell>
	);
}

function ProposalShell({
	businessName,
	wide = false,
	children,
}: {
	businessName?: string;
	wide?: boolean;
	children: ReactNode;
}) {
	return (
		<main className="flex min-h-svh flex-col items-center bg-muted px-4 py-10 sm:py-16">
			<div
				className={`flex w-full flex-col items-center gap-8 ${wide ? "max-w-3xl" : "max-w-xl"}`}
			>
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo className="size-6 shrink-0 text-foreground" />
					{businessName ? (
						<p className="font-medium text-foreground text-sm/5">
							{businessName}
						</p>
					) : null}
				</div>

				<div className="flex w-full flex-col gap-4">{children}</div>
			</div>
		</main>
	);
}

function MessageCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children?: ReactNode;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-2 py-8 text-center">
				<p className="font-medium text-base">{title}</p>
				{description ? (
					<p className="text-muted-foreground text-sm/5">{description}</p>
				) : null}
				{children}
			</CardContent>
		</Card>
	);
}
