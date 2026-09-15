import { redirect } from "next/navigation";
import { requireModuleView } from "@/lib/access-page";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function RecordRedirect({
	params,
}: {
	params: Promise<{ slug: string; contactId: string }>;
}) {
	const [{ slug, contactId }] = await Promise.all([
		params,
		requireModuleView("/contacts"),
	]);
	redirect(recordHref(slug, "/contacts", "contact", contactId));
}
