import { redirect } from "next/navigation";
import { requireModuleView } from "@/lib/access-page";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function RecordRedirect({
	params,
}: {
	params: Promise<{ slug: string; dealId: string }>;
}) {
	const [{ slug, dealId }] = await Promise.all([
		params,
		requireModuleView("/deals"),
	]);
	redirect(recordHref(slug, "/deals", "deal", dealId));
}
