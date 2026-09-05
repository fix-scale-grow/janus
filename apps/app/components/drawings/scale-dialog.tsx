"use client";

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
import { useState } from "react";

export type ScaleDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (feet: number) => void;
};

export function ScaleDialog(props: ScaleDialogProps) {
	const [feet, setFeet] = useState("");
	const parsed = Number.parseFloat(feet);
	const valid = Number.isFinite(parsed) && parsed > 0;

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) setFeet("");
				props.onOpenChange(open);
			}}
			open={props.open}
		>
			<DialogContent className="sm:max-w-(--container-narrow)">
				<DialogHeader>
					<DialogTitle>Set scale</DialogTitle>
					<DialogDescription>How long is this line in feet?</DialogDescription>
				</DialogHeader>

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

				<DialogFooter>
					<Button onClick={() => props.onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() => {
							if (!valid) return;
							props.onConfirm(parsed);
							setFeet("");
						}}
					>
						Set scale
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
