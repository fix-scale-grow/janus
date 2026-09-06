import { workspaceUrl } from "@/lib/workspace-url";

export function recordHref(
	slug: string,
	list: "/contacts" | "/deals",
	kind: "contact" | "deal",
	id: string,
): string {
	const query = new URLSearchParams({ record: `${kind}:${id}` });

	return `${workspaceUrl(slug, list)}?${query}`;
}
