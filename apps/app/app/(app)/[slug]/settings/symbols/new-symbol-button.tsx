"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function NewSymbolButton() {
	const workspaceUrl = useWorkspaceUrl();

	return (
		<Button asChild size="sm">
			<Link href={workspaceUrl("/settings/symbols/new")}>
				<Icon data-icon="inline-start" icon={Add} />
				New symbol
			</Link>
		</Button>
	);
}
