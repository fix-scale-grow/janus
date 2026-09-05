"use client";

import type { ExcalidrawElement } from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const NONE = "none";

type FormValues = {
	name: string;
	trade: string;
	widthFt: string;
	heightFt: string;
	serviceId: string;
};

function emptyForm(): FormValues {
	return {
		name: "",
		trade: "roofing",
		widthFt: "",
		heightFt: "",
		serviceId: NONE,
	};
}

function parseOptionalPositiveFt(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

export type SaveSymbolDialogProps = {
	elements: ExcalidrawElement[] | null;
	onOpenChange: (open: boolean) => void;
	services: { id: string; name: string }[];
};

export function SaveSymbolDialog(props: SaveSymbolDialogProps) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [values, setValues] = useState<FormValues>(emptyForm());
	const open = props.elements !== null;

	useEffect(() => {
		if (open) setValues(emptyForm());
	}, [open]);

	const nameId = useId();
	const tradeId = useId();
	const widthId = useId();
	const heightId = useId();
	const serviceFieldId = useId();

	const create = useMutation(
		trpc.symbols.create.mutationOptions({
			onSuccess: async () => {
				await cache.symbol();
				toast.success("Symbol saved.");
				props.onOpenChange(false);
			},
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const submit = () => {
		if (!props.elements) return;

		const name = values.name.trim();
		if (!name) {
			toast.error("A symbol needs a name.");
			return;
		}

		const widthFt = parseOptionalPositiveFt(values.widthFt);
		if (widthFt === undefined) {
			toast.error("Width has to be a number greater than zero.");
			return;
		}

		const heightFt = parseOptionalPositiveFt(values.heightFt);
		if (heightFt === undefined) {
			toast.error("Height has to be a number greater than zero.");
			return;
		}

		create.mutate({
			name,
			trade: values.trade.trim() || "roofing",
			elements: props.elements,
			widthFt,
			heightFt,
			serviceId: values.serviceId === NONE ? null : values.serviceId,
		});
	};

	const formId = "save-symbol-form";

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) setValues(emptyForm());
				props.onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save as symbol</DialogTitle>
					<DialogDescription>
						Add this shape to the symbol palette so it can be placed again.
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex flex-col gap-4"
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<Field>
						<FieldLabel htmlFor={nameId}>Name</FieldLabel>
						<Input
							autoFocus
							id={nameId}
							onChange={(event) =>
								setValues((prev) => ({ ...prev, name: event.target.value }))
							}
							value={values.name}
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor={tradeId}>Trade</FieldLabel>
						<Input
							id={tradeId}
							onChange={(event) =>
								setValues((prev) => ({ ...prev, trade: event.target.value }))
							}
							value={values.trade}
						/>
					</Field>

					<div className="grid grid-cols-2 gap-3">
						<Field>
							<FieldLabel htmlFor={widthId}>Width (ft)</FieldLabel>
							<Input
								id={widthId}
								inputMode="decimal"
								onChange={(event) =>
									setValues((prev) => ({
										...prev,
										widthFt: event.target.value,
									}))
								}
								placeholder="Optional"
								value={values.widthFt}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={heightId}>Height (ft)</FieldLabel>
							<Input
								id={heightId}
								inputMode="decimal"
								onChange={(event) =>
									setValues((prev) => ({
										...prev,
										heightFt: event.target.value,
									}))
								}
								placeholder="Optional"
								value={values.heightFt}
							/>
						</Field>
					</div>

					<Field>
						<FieldLabel htmlFor={serviceFieldId}>Linked service</FieldLabel>
						<Select
							onValueChange={(serviceId) =>
								setValues((prev) => ({ ...prev, serviceId }))
							}
							value={values.serviceId}
						>
							<SelectTrigger className="w-full" id={serviceFieldId}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>None</SelectItem>
								{props.services.map((service) => (
									<SelectItem key={service.id} value={service.id}>
										{service.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</form>

				<DialogFooter>
					<Button
						onClick={() => props.onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={create.isPending} form={formId} type="submit">
						{create.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
