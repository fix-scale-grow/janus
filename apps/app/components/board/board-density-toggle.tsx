"use client";

import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import type { BoardDensity } from "./use-board-density";

export function BoardDensityToggle({
	density,
	onDensityChange,
}: {
	density: BoardDensity;
	onDensityChange: (next: BoardDensity) => void;
}) {
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			value={density}
			onValueChange={(next) => {
				if (next === "comfortable" || next === "compact") {
					onDensityChange(next);
				}
			}}
			aria-label="Card density"
		>
			<ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
			<ToggleGroupItem value="compact">Compact</ToggleGroupItem>
		</ToggleGroup>
	);
}
