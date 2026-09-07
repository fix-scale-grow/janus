import { Button } from "@crm/ui/components/button";
import { db } from "@crm/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
	title: "Janus",
	description:
		"The agent-first CRM for the trades. Draw the job, and Janus measures it, prices it from your book, and carries it from estimate to signed contract to invoice.",
};

export const instant = false;

const FEATURES = [
	{
		title: "Scope it on screen",
		body: "Sketch the job on a whiteboard, over a photo, or straight onto a satellite view. Set the scale once and every shape carries real measurements.",
	},
	{
		title: "Priced from your book",
		body: "Tag shapes with your services and Janus drafts a Good, Better, Best estimate from your price book. Prices are snapshotted, so a book change never rewrites a sent quote.",
	},
	{
		title: "Ask Janus",
		body: "Janus reads the job and proposes the next step: tag the drawing, add the missing line, bump a price. Nothing changes until you approve the card.",
	},
	{
		title: "Estimate to invoice",
		body: "Send the estimate, get the contract signed on a phone, convert to an invoice with aging. One thread from first sketch to paid.",
	},
];

export default async function Home() {
	const session = await getSession();
	if (session) {
		const member = await db.member.findFirst({
			where: { userId: session.user.id },
			select: { organization: { select: { slug: true } } },
		});
		if (member?.organization.slug) {
			redirect(`/${member.organization.slug}`);
		}
	}

	return (
		<div className="flex min-h-svh w-full flex-col bg-background text-foreground">
			<header className="flex items-center justify-between px-6 py-4 sm:px-10">
				<span className="font-semibold text-lg tracking-tight">Janus</span>
				<Button asChild variant="outline" size="sm">
					<Link href="/sign-in">Sign in</Link>
				</Button>
			</header>

			<main className="flex w-full flex-1 flex-col items-center px-6 sm:px-10">
				<section className="flex w-full max-w-3xl flex-col items-center gap-6 pt-20 pb-16 text-center sm:pt-28">
					<h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
						Draw the job. Janus does the paperwork.
					</h1>
					<p className="max-w-xl text-balance text-lg text-muted-foreground">
						The agent-first CRM for the trades. Measure from a sketch, a photo,
						or a satellite view, price it from your own book, and carry the job
						from estimate to signed contract to invoice.
					</p>
					<Button asChild size="lg">
						<Link href="/sign-in">Open Janus</Link>
					</Button>
				</section>

				<section className="grid w-full max-w-4xl grid-cols-1 gap-4 pb-24 sm:grid-cols-2">
					{FEATURES.map((feature) => (
						<div
							key={feature.title}
							className="rounded-lg border bg-card p-6 text-card-foreground"
						>
							<h2 className="font-semibold text-base">{feature.title}</h2>
							<p className="mt-2 text-muted-foreground text-sm/6">
								{feature.body}
							</p>
						</div>
					))}
				</section>
			</main>

			<footer className="px-6 py-6 text-center text-muted-foreground text-sm sm:px-10">
				Every change Janus proposes, you approve first.
			</footer>
		</div>
	);
}
