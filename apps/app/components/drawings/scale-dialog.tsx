"use client";

import { Alert, AlertDescription } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useState } from "react";

export const GRID_OFF = "off";

export const GRID_OPTIONS = [
	{ value: GRID_OFF, label: "Off" },
	{ value: "1", label: "1 ft per square" },
	{ value: "5", label: "5 ft per square" },
	{ value: "10", label: "10 ft per square" },
] as const;

export type ScaleDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (feet: number, gridFt: number | null) => void;
	replacing: boolean;
	defaultGridFt: number | null;
};

export function ScaleDialog(props: ScaleDialogProps) {
	const defaultGrid = props.defaultGridFt
		? String(props.defaultGridFt)
		: GRID_OFF;
	const [feet, setFeet] = useState("");
	const [grid, setGrid] = useState<string>(defaultGrid);
	const parsed = Number.parseFloat(feet);
	const valid = Number.isFinite(parsed) && parsed > 0;

	const reset = () => {
		setFeet("");
		setGrid(defaultGrid);
	};

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) reset();
				props.onOpenChange(open);
			}}
			open={props.open}
		>
			<DialogContent className="sm:max-w-(--container-narrow)">
				<DialogHeader>
					<DialogTitle>
						{props.replacing ? "Replace scale" : "Set scale"}
					</DialogTitle>
					<DialogDescription>How long is this line in feet?</DialogDescription>
				</DialogHeader>

				{props.replacing && (
					<Alert variant="warning">
						<AlertDescription>
							This drawing already has a scale. Confirming replaces it and
							updates every measurement on the drawing.
						</AlertDescription>
					</Alert>
				)}

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="scale-feet">Length in feet</Label>
					<Input
						autoFocus
						id="scale-feet"
						inputMode="decimal"
						onChange={(event) => setFeet(event.target.value)}
						placeholder="20"
						value={feet}
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="scale-grid">Show grid</Label>
					<Select onValueChange={setGrid} value={grid}>
						<SelectTrigger className="w-full" id="scale-grid">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{GRID_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<Button onClick={() => props.onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() => {
							if (!valid) return;
							props.onConfirm(
								parsed,
								grid === GRID_OFF ? null : Number.parseFloat(grid),
							);
							reset();
						}}
					>
						{props.replacing ? "Replace scale" : "Set scale"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
