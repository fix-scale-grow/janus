import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
	return (
		<PageShell>
			<div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
				<p className="font-medium text-sm">This record could not be loaded</p>
				<p className="text-muted-foreground text-xs">
					It may have been deleted, or the link is wrong.
				</p>
				<Button asChild size="sm" className="mt-3">
					<Link href="/">Back to the CRM</Link>
				</Button>
			</div>
		</PageShell>
	);
}
