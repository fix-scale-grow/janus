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
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
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
import {
	JURISDICTION_KIND_LABEL,
	JURISDICTION_KINDS,
	type JurisdictionKind,
	PERMIT_TYPE_LABEL,
	PERMIT_TYPES,
	type PermitType,
} from "@/lib/permits/permit-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useSubmitGuard } from "@/lib/use-submit-guard";

type JurisdictionGuess = { name: string; state: string } | null;

export function NewPermitDialog({
	dealId,
	jurisdictionGuess,
	open,
	onOpenChange,
}: {
	dealId: string;
	jurisdictionGuess: JurisdictionGuess;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const guard = useSubmitGuard();

	const [name, setName] = useState(jurisdictionGuess?.name ?? "");
	const [kind, setKind] = useState<JurisdictionKind>("CITY");
	const [state, setState] = useState(jurisdictionGuess?.state ?? "");
	const [permitType, setPermitType] = useState<PermitType>("BUILDING");
	const [typeLabel, setTypeLabel] = useState("");

	useEffect(() => {
		if (!open) return;
		setName(jurisdictionGuess?.name ?? "");
		setKind("CITY");
		setState(jurisdictionGuess?.state ?? "");
		setPermitType("BUILDING");
		setTypeLabel("");
	}, [open, jurisdictionGuess]);

	const nameId = useId();
	const kindId = useId();
	const stateId = useId();
	const typeId = useId();
	const typeLabelId = useId();

	const resolveJurisdiction = useMutation(
		trpc.permits.resolveJurisdiction.mutationOptions(),
	);
	const create = useMutation(
		trpc.permits.create.mutationOptions({
			onSuccess: async () => {
				await cache.permit();
				toast.success("Permit opened.");
				onOpenChange(false);
			},
			onError: (error: { message: string }) => toast.error(error.message),
			onSettled: () => guard.release(),
		}),
	);

	const busy = resolveJurisdiction.isPending || create.isPending;
	const ready =
		name.trim() !== "" &&
		state.trim().length === 2 &&
		(permitType !== "OTHER" || typeLabel.trim() !== "");

	const submit = () => {
		if (!ready) return;
		guard.guard(async () => {
			try {
				const jurisdiction = await resolveJurisdiction.mutateAsync({
					name: name.trim(),
					kind,
					state: state.trim().toUpperCase(),
				});
				create.mutate({
					dealId,
					jurisdictionId: jurisdiction.id,
					permitType,
					typeLabel: permitType === "OTHER" ? typeLabel.trim() : undefined,
				});
			} catch (error) {
				guard.release();
				toast.error(
					error instanceof Error
						? error.message
						: "Could not resolve the jurisdiction.",
				);
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Open a permit</DialogTitle>
					<DialogDescription>
						Tell us where and what kind. Janus builds the checklist from there.
					</DialogDescription>
				</DialogHeader>

				<form
					id="new-permit"
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Jurisdiction name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								autoFocus
								placeholder="Homosassa"
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>

						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor={kindId}>Kind</FieldLabel>
								<Select
									value={kind}
									onValueChange={(next) => setKind(next as JurisdictionKind)}
								>
									<SelectTrigger id={kindId} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{JURISDICTION_KINDS.map((value) => (
											<SelectItem key={value} value={value}>
												{JURISDICTION_KIND_LABEL[value]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor={stateId}>State</FieldLabel>
								<Input
									id={stateId}
									value={state}
									maxLength={2}
									placeholder="FL"
									onChange={(event) =>
										setState(event.target.value.toUpperCase())
									}
								/>
							</Field>
						</div>

						<Field>
							<FieldLabel htmlFor={typeId}>Permit type</FieldLabel>
							<Select
								value={permitType}
								onValueChange={(next) => setPermitType(next as PermitType)}
							>
								<SelectTrigger id={typeId} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PERMIT_TYPES.map((value) => (
										<SelectItem key={value} value={value}>
											{PERMIT_TYPE_LABEL[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						{permitType === "OTHER" ? (
							<Field>
								<FieldLabel htmlFor={typeLabelId}>
									Describe the permit
								</FieldLabel>
								<Input
									id={typeLabelId}
									value={typeLabel}
									placeholder="Fence permit"
									onChange={(event) => setTypeLabel(event.target.value)}
								/>
							</Field>
						) : null}
					</FieldGroup>
				</form>

				<DialogFooter>
					<Button type="submit" form="new-permit" disabled={!ready || busy}>
						{busy ? <Spinner data-icon="inline-start" /> : null}
						Open permit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
