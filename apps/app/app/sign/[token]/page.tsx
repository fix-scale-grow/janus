import { Card, CardContent } from "@crm/ui/components/card";
import Logo from "@crm/ui/components/logo";
import { TRPCClientError } from "@trpc/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocalDay } from "@/components/local-date-time";
import { getServerTrpcClient } from "@/lib/trpc/server";
import type { RouterOutputs } from "@/lib/trpc/types";
import { SigningView } from "./signing-view";

export const metadata: Metadata = { title: "Sign contract" };

type SignedContract = RouterOutputs["contractSigning"]["bySigningToken"];

export default async function SignPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const client = getServerTrpcClient();

	let contract: SignedContract;
	try {
		contract = await client.contractSigning.bySigningToken.query({ token });
	} catch (error) {
		if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
			notFound();
		}

		return (
			<SignShell>
				<MessageCard title="This contract is no longer available." />
			</SignShell>
		);
	}

	if (contract.status === "VOID") {
		return (
			<SignShell businessName={contract.businessName}>
				<MessageCard title="This contract is no longer available." />
			</SignShell>
		);
	}

	if (contract.status === "SIGNED") {
		return (
			<SignShell businessName={contract.businessName}>
				<MessageCard title="This contract is signed.">
					{contract.signerName && contract.signedAt ? (
						<p className="text-sm/5 text-muted-foreground">
							Signed by {contract.signerName} on{" "}
							<LocalDay date={contract.signedAt} />.
						</p>
					) : null}
				</MessageCard>
			</SignShell>
		);
	}

	if (contract.expired) {
		return (
			<SignShell businessName={contract.businessName}>
				<MessageCard
					title="This signing link has expired"
					description={`Ask ${contract.businessName} to send a new one.`}
				/>
			</SignShell>
		);
	}

	return (
		<SignShell businessName={contract.businessName}>
			<SigningView
				token={token}
				title={contract.title}
				number={contract.number}
				bodyHtml={contract.bodyHtml}
			/>
		</SignShell>
	);
}

function SignShell({
	businessName,
	children,
}: {
	businessName?: string;
	children: ReactNode;
}) {
	return (
		<main className="flex min-h-svh flex-col items-center bg-muted px-4 py-10 sm:py-16">
			<div className="flex w-full max-w-xl flex-col items-center gap-8">
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo className="size-6 shrink-0 text-foreground" />
					{businessName ? (
						<p className="text-sm/5 font-medium text-foreground">
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
			<CardContent>
				<div className="flex flex-col items-center gap-2 text-center">
					<p className="text-base/6 font-medium text-foreground">{title}</p>
					{description ? (
						<p className="text-sm/5 text-muted-foreground">{description}</p>
					) : null}
					{children}
				</div>
			</CardContent>
		</Card>
	);
}
