"use client";

import { Badge } from "@crm/ui/components/badge";
import { useMergeFields } from "./merge-fields";

export function FieldSidebar({
	onInsert,
}: {
	onInsert: (token: string) => void;
}) {
	const { groups } = useMergeFields();

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex flex-col gap-0.5">
				<h2 className="font-medium text-sm">Merge fields</h2>
				<p className="text-muted-foreground text-xs">
					Click a field to drop it where the cursor is.
				</p>
			</div>
			{groups
				.filter((group) => group.fields.length > 0)
				.map((group) => (
					<div key={group.id} className="flex flex-col gap-1.5">
						<span className="font-medium text-muted-foreground text-xs">
							{group.label}
						</span>
						<div className="flex flex-wrap gap-1">
							{group.fields.map((field) => (
								<Badge key={field.token} variant="field" asChild>
									<button
										type="button"
										title={`{{${field.token}}}`}
										onClick={() => onInsert(field.token)}
									>
										{field.label}
									</button>
								</Badge>
							))}
						</div>
					</div>
				))}
		</div>
	);
}
