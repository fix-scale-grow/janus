"use client";

import type { TemplatePurpose } from "@crm/db/enums";
import { Spinner } from "@crm/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function TemplatePreview({
	purpose,
	subject,
	stale,
}: {
	purpose: TemplatePurpose;
	subject: string | null;
	stale: boolean;
}) {
	const trpc = useTRPC();
	const preview = useQuery(trpc.templates.preview.queryOptions({ purpose }));
	const resolved = preview.data?.subject ?? subject ?? "";

	return (
		<div className="flex flex-col gap-3">
			{resolved ? (
				<div className="flex flex-col gap-0.5 rounded-lg border px-4 py-2">
					<span className="text-muted-foreground text-xs">Subject</span>
					<span className="font-medium text-sm">{resolved}</span>
				</div>
			) : null}
			{stale ? (
				<p className="text-muted-foreground text-xs">
					This preview shows the saved template. Save to see your changes.
				</p>
			) : null}
			<div className="overflow-hidden rounded-lg border">
				{preview.isPending ? (
					<div className="flex justify-center py-12">
						<Spinner size="lg" />
					</div>
				) : (
					<iframe
						title="Template preview"
						sandbox=""
						srcDoc={preview.data?.html ?? ""}
						className="h-[640px] w-full"
					/>
				)}
			</div>
		</div>
	);
}
