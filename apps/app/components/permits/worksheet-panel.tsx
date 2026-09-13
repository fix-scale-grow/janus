"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowDown from "@carbon/icons-react/es/ArrowDown";
import ArrowUp from "@carbon/icons-react/es/ArrowUp";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useRecordSheetView } from "@/components/crm/record-sheet/record-stack";
import {
	PERMIT_DISCLAIMER,
	PERMIT_TYPE_LABEL,
	WORKSHEET_FIELD_TYPE_LABEL,
	WORKSHEET_FIELD_TYPES,
	type WorksheetFieldType,
} from "@/lib/permits/permit-status";
import {
	isWorksheetHardBlocked,
	uniqueWorksheetFieldKey,
	worksheetBlockingReason,
} from "@/lib/permits/worksheet-ui";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import { aiFillMessage } from "./fill-mode-dialog";
import { WorksheetFieldRow } from "./worksheet-field-row";

type Permit = RouterOutputs["permits"]["byId"];
type WorksheetField = Permit["worksheetTemplate"][number];

export function WorksheetPanel({
	permit,
	open,
	onOpenChange,
}: {
	permit: Permit;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { openAgent } = useRecordSheetView("overview");
	const approveAllGuard = useSubmitGuard();
	const generateGuard = useSubmitGuard();

	const [editingTemplate, setEditingTemplate] = useState(false);
	const [removeTarget, setRemoveTarget] = useState<WorksheetField | null>(null);
	const [disclaimerOpen, setDisclaimerOpen] = useState(false);

	const disclaimerSettings = useQuery(trpc.settings.permits.queryOptions());
	const disclaimerAccepted = disclaimerSettings.data
		? disclaimerSettings.data.disclaimer !== null
		: false;

	const invalidatePermit = () => cache.permit(permit.id, { settle: "record" });

	const setAnswer = useMutation(
		trpc.permits.setAnswer.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const approveAnswer = useMutation(
		trpc.permits.approveAnswer.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const clearAnswer = useMutation(
		trpc.permits.clearAnswer.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const approveAllReviewed = useMutation(
		trpc.permits.approveAllReviewed.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
			onSettled: () => approveAllGuard.release(),
		}),
	);

	const applyPrefills = useMutation(
		trpc.permits.applyPrefills.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const setWorksheetTemplate = useMutation(
		trpc.permits.setWorksheetTemplate.mutationOptions({
			onSuccess: invalidatePermit,
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const acceptDisclaimer = useMutation(
		trpc.settings.acceptPermitDisclaimer.mutationOptions({
			onSuccess: () => cache.settings({ settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const answers = permit.worksheetAnswers;
	const fields = permit.worksheetTemplate;

	const approvedCount = Object.values(answers).filter(
		(answer) => answer.value !== "" && answer.state === "APPROVED",
	).length;
	const needsReviewCount = Object.values(answers).filter(
		(answer) => answer.value !== "" && answer.state === "NEEDS_REVIEW",
	).length;

	const answerPending =
		setAnswer.isPending || approveAnswer.isPending || clearAnswer.isPending;

	const reason = worksheetBlockingReason({
		fields,
		answers,
		disclaimerAccepted,
	});
	const hardBlocked = isWorksheetHardBlocked({ fields, answers });

	const commitAnswer = (field: WorksheetField, value: string) => {
		const current = answers[field.key];
		if (value === "") {
			if (current !== undefined) {
				clearAnswer.mutate({ permitId: permit.id, key: field.key });
			}
			return;
		}
		if (current !== undefined) {
			approveAnswer.mutate({ permitId: permit.id, key: field.key, value });
		} else {
			setAnswer.mutate({ permitId: permit.id, key: field.key, value });
		}
	};

	const approveField = (field: WorksheetField) =>
		approveAnswer.mutate({ permitId: permit.id, key: field.key });

	const clearField = (field: WorksheetField) =>
		clearAnswer.mutate({ permitId: permit.id, key: field.key });

	const runAiFill = () => {
		applyPrefills.mutate(
			{ permitId: permit.id },
			{ onSuccess: () => openAgent(aiFillMessage(permit.id)) },
		);
	};

	const saveTemplate = (nextFields: WorksheetField[]) => {
		if (!permit.playbookId) return;
		setWorksheetTemplate.mutate({
			playbookId: permit.playbookId,
			fields: nextFields,
		});
	};

	const confirmRemove = (field: WorksheetField) => {
		const hasAnswer = (answers[field.key]?.value ?? "") !== "";
		if (hasAnswer) {
			setRemoveTarget(field);
			return;
		}
		saveTemplate(fields.filter((entry) => entry.key !== field.key));
	};

	const generateWorksheetPdfPlaceholder = () => {
		toast("PDF generation lands with the next update.");
	};

	const onGenerateClick = () => {
		if (hardBlocked) return;
		if (!disclaimerAccepted) {
			setDisclaimerOpen(true);
			return;
		}
		generateGuard.guard(generateWorksheetPdfPlaceholder);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="gap-0 p-0" size="lg">
				<SheetHeader className="border-b">
					<SheetTitle>Permit worksheet</SheetTitle>
					<SheetDescription>
						{permit.typeLabel || PERMIT_TYPE_LABEL[permit.permitType]} ·{" "}
						{permit.jurisdiction.name}, {permit.jurisdiction.state}
					</SheetDescription>
				</SheetHeader>

				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={applyPrefills.isPending}
								onClick={runAiFill}
							>
								{applyPrefills.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Run AI fill
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!permit.playbookId}
								onClick={() => setEditingTemplate((value) => !value)}
							>
								{editingTemplate ? "Done editing" : "Edit template"}
							</Button>
						</div>

						{needsReviewCount > 1 ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={approveAllReviewed.isPending}
								onClick={() =>
									approveAllGuard.guard(() =>
										approveAllReviewed.mutate({ permitId: permit.id }),
									)
								}
							>
								Approve all reviewed
							</Button>
						) : null}
					</div>

					<div className="flex flex-col gap-3 p-4">
						{editingTemplate ? (
							<TemplateEditor
								fields={fields}
								pending={setWorksheetTemplate.isPending}
								onSave={saveTemplate}
								onRemove={confirmRemove}
							/>
						) : fields.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								This permit has no worksheet fields yet.
							</p>
						) : (
							fields.map((field) => (
								<WorksheetFieldRow
									key={`${field.key}:${answers[field.key]?.value ?? ""}:${answers[field.key]?.state ?? ""}`}
									field={field}
									answer={answers[field.key]}
									pending={answerPending}
									onCommit={(value) => commitAnswer(field, value)}
									onApprove={() => approveField(field)}
									onClear={() => clearField(field)}
								/>
							))
						)}
					</div>
				</div>

				<SheetFooter className="border-t">
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground text-xs">
							{approvedCount} of {fields.length} approved
						</span>
						<div className="flex flex-col items-end gap-1">
							{reason ? (
								<span className="text-muted-foreground text-xs">{reason}</span>
							) : null}
							<Button
								type="button"
								disabled={hardBlocked}
								onClick={onGenerateClick}
							>
								Generate
							</Button>
						</div>
					</div>
				</SheetFooter>

				<AlertDialog
					open={removeTarget !== null}
					onOpenChange={(next) => {
						if (!next) setRemoveTarget(null);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove this field?</AlertDialogTitle>
							<AlertDialogDescription>
								{removeTarget?.label} already has an answer. Removing it from
								the worksheet does not delete that answer.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={() => {
									if (!removeTarget) return;
									saveTemplate(
										fields.filter((entry) => entry.key !== removeTarget.key),
									);
									setRemoveTarget(null);
								}}
							>
								Remove field
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Before you generate</DialogTitle>
							<DialogDescription>{PERMIT_DISCLAIMER}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								type="button"
								disabled={acceptDisclaimer.isPending}
								onClick={() =>
									acceptDisclaimer.mutate(undefined, {
										onSuccess: () => {
											setDisclaimerOpen(false);
											generateGuard.guard(generateWorksheetPdfPlaceholder);
										},
									})
								}
							>
								{acceptDisclaimer.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Accept
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</SheetContent>
		</Sheet>
	);
}

function TemplateEditor({
	fields,
	pending,
	onSave,
	onRemove,
}: {
	fields: WorksheetField[];
	pending: boolean;
	onSave: (fields: WorksheetField[]) => void;
	onRemove: (field: WorksheetField) => void;
}) {
	const [newLabel, setNewLabel] = useState("");
	const [newType, setNewType] = useState<WorksheetFieldType>("TEXT");
	const [newRequired, setNewRequired] = useState(false);

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= fields.length) return;
		const next = [...fields];
		const [moved] = next.splice(index, 1);
		if (!moved) return;
		next.splice(target, 0, moved);
		onSave(next);
	};

	const updateField = (index: number, patch: Partial<WorksheetField>) => {
		const next = fields.map((field, entryIndex) =>
			entryIndex === index ? { ...field, ...patch } : field,
		);
		onSave(next);
	};

	const addField = () => {
		const label = newLabel.trim();
		if (!label) return;
		const key = uniqueWorksheetFieldKey(
			label,
			fields.map((field) => field.key),
		);
		onSave([
			...fields,
			{ key, label, type: newType, prefill: null, required: newRequired },
		]);
		setNewLabel("");
		setNewType("TEXT");
		setNewRequired(false);
	};

	return (
		<div className="flex flex-col gap-3">
			{fields.map((field, index) => (
				<div
					key={field.key}
					className="flex flex-col gap-2 rounded-lg border p-2.5"
				>
					<div className="flex flex-wrap items-center gap-2">
						<Input
							value={field.label}
							disabled={pending}
							onChange={(event) =>
								updateField(index, { label: event.target.value })
							}
							className="min-w-0 flex-1"
						/>
						<Select
							value={field.type}
							disabled={pending}
							onValueChange={(next) =>
								updateField(index, { type: next as WorksheetFieldType })
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{WORKSHEET_FIELD_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{WORKSHEET_FIELD_TYPE_LABEL[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className="flex items-center gap-1.5">
							<Switch
								checked={field.required}
								disabled={pending}
								onCheckedChange={(checked) =>
									updateField(index, { required: checked })
								}
							/>
							<span className="text-muted-foreground text-xs">Required</span>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending || index === 0}
							onClick={() => move(index, -1)}
						>
							<Icon icon={ArrowUp} />
							<span className="sr-only">Move {field.label} up</span>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending || index === fields.length - 1}
							onClick={() => move(index, 1)}
						>
							<Icon icon={ArrowDown} />
							<span className="sr-only">Move {field.label} down</span>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending}
							onClick={() => onRemove(field)}
						>
							<Icon icon={TrashCan} />
							<span className="sr-only">Remove {field.label}</span>
						</Button>
					</div>
				</div>
			))}

			<div className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
				<Input
					placeholder="New field label"
					value={newLabel}
					disabled={pending}
					onChange={(event) => setNewLabel(event.target.value)}
					className="min-w-0 flex-1"
				/>
				<Select
					value={newType}
					disabled={pending}
					onValueChange={(next) => setNewType(next as WorksheetFieldType)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{WORKSHEET_FIELD_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{WORKSHEET_FIELD_TYPE_LABEL[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-1.5">
					<Switch
						checked={newRequired}
						disabled={pending}
						onCheckedChange={setNewRequired}
					/>
					<span className="text-muted-foreground text-xs">Required</span>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={pending || newLabel.trim() === ""}
					onClick={addField}
				>
					<Icon icon={Add} data-icon="inline-start" />
					Add field
				</Button>
			</div>
		</div>
	);
}
