import { redirect } from "next/navigation";

export default async function CrewsSettingsPage({
	params,
}: PageProps<"/[slug]/settings/crews">) {
	const { slug } = await params;
	redirect(`/${slug}/settings/team`);
}
