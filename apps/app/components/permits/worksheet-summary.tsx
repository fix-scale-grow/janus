import { Button } from "@crm/ui/components/button";

export function WorksheetSummary({
	approvedCount,
	totalCount,
}: {
	approvedCount: number | null;
	totalCount: number | null;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
			<div className="flex flex-col gap-0.5">
				<span className="font-medium text-sm">Worksheet</span>
				{approvedCount !== null && totalCount !== null ? (
					<span className="text-muted-foreground text-xs">
						{approvedCount} of {totalCount} approved
					</span>
				) : null}
			</div>
			<Button type="button" variant="outline" size="sm" disabled>
				Open worksheet
			</Button>
		</div>
	);
}
