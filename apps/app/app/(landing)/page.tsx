import { db } from "@crm/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentSection } from "@/components/landing/agent-section";
import { LandingAnalytics } from "@/components/landing/analytics";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProductShot } from "@/components/landing/product-shot/product-shot";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
	title: "The CRM for agents",
	description:
		"The first agentic CRM experience — durable research agents that read your inbox, keep every record current and book their own follow-ups.",
};

export const instant = false;

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
		<div className="dark flex min-h-svh w-full flex-col items-center overflow-clip bg-background font-sans text-foreground">
			<LandingNav />
			<Hero />
			<ProductShot />
			<AgentSection />
			<CapabilitiesSection />
			<ClosingCta />
			<LandingFooter />
			<LandingAnalytics />
		</div>
	);
}
