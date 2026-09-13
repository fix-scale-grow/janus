import { redirect } from "next/navigation";

export default async function MembersSettingsPage({
	params,
}: PageProps<"/[slug]/settings/members">) {
	const { slug } = await params;
	redirect(`/${slug}/settings/team`);
}
