"use client";

import {
	type MeasuredShape,
	PITCH_FACTORS,
	type PitchKey,
} from "@crm/drawings";
import { Badge } from "@crm/ui/components/badge";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMemo } from "react";

export type ScopeShapeUpdate = {
	label?: string | null;
	pitch?: PitchKey | null;
};

export type ScopePanelProps = {
	shapes: MeasuredShape[];
	onUpdateShape: (scopeId: string, update: ScopeShapeUpdate) => void;
};

function quantityLabel(shape: MeasuredShape): string | null {
	if (!shape.quantity) return null;
	if ("areaSqFt" in shape.quantity) {
		return `${shape.quantity.areaSqFt.toFixed(1)} sq ft · ${shape.quantity.squares.toFixed(1)} sq`;
	}
	if ("lengthFt" in shape.quantity) {
		return `${Math.round(shape.quantity.lengthFt)} ln ft`;
	}
	return `${shape.quantity.count} pin${shape.quantity.count === 1 ? "" : "s"}`;
}

function kindLabel(kind: MeasuredShape["kind"]): string {
	if (kind === "area") return "Area";
	if (kind === "line") return "Line";
	return "Pin";
}

export function ScopePanel(props: ScopePanelProps) {
	const pinCount = useMemo(
		() =>
			props.shapes.reduce((total, shape) => {
				if (shape.kind !== "pin" || !shape.quantity) return total;
				return total + ("count" in shape.quantity ? shape.quantity.count : 0);
			}, 0),
		[props.shapes],
	);
	const rows = props.shapes.filter((shape) => shape.kind !== "pin");

	return (
		<div className="flex h-full w-72 shrink-0 flex-col gap-3 overflow-y-auto border-border border-l p-3">
			<h2 className="font-heading text-sm font-medium">Scope</h2>

			{rows.length === 0 && pinCount === 0 && (
				<p className="text-muted-foreground text-xs">
					Mark a shape to measure it.
				</p>
			)}

			{pinCount > 0 && (
				<div className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
					<span>Pins</span>
					<span className="text-muted-foreground">{pinCount}</span>
				</div>
			)}

			{rows.map((shape) => (
				<div
					className="flex flex-col gap-2 rounded-md border border-border p-2"
					key={shape.scopeId}
				>
					<div className="flex items-center justify-between gap-2">
						<Badge variant="outline">{kindLabel(shape.kind)}</Badge>
						<span className="text-muted-foreground text-xs">
							{quantityLabel(shape) ?? "unmeasured — set scale"}
						</span>
					</div>

					<Input
						onChange={(event) =>
							props.onUpdateShape(shape.scopeId, {
								label: event.target.value || null,
							})
						}
						placeholder="Label"
						value={shape.label ?? ""}
					/>

					{shape.kind === "area" && (
						<Select
							onValueChange={(value) =>
								props.onUpdateShape(shape.scopeId, {
									pitch: value as PitchKey,
								})
							}
							value={shape.pitch ?? undefined}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Pitch" />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(PITCH_FACTORS).map((pitch) => (
									<SelectItem key={pitch} value={pitch}>
										{pitch}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			))}
		</div>
	);
}
