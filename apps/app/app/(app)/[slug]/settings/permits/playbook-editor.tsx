"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowDown from "@carbon/icons-react/es/ArrowDown";
import ArrowUp from "@carbon/icons-react/es/ArrowUp";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Launch from "@carbon/icons-react/es/Launch";
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
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	FACT_PATH_LABEL,
	FACT_PATHS,
	type FactPath,
	type PermitType,
	WORKSHEET_FIELD_TYPE_LABEL,
	WORKSHEET_FIELD_TYPES,
	WORKSHEET_PREFILL_KEYS,
	WORKSHEET_PREFILL_LABEL,
	type WorksheetFieldType,
	type WorksheetPrefillKey,
} from "@/lib/permits/permit-status";
import { uniqueWorksheetFieldKey } from "@/lib/permits/worksheet-ui";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	ADD_DOCUMENT,
	ADD_FIELD,
	ADD_INSPECTION,
	ADD_PREREQUISITE,
	CANCEL,
	DOCUMENT_LABEL_LABEL,
	DOCUMENT_REUSABLE_LABEL,
	DOCUMENT_SOURCE_LABEL,
	DOCUMENTS_EMPTY,
	DOCUMENTS_TITLE,
	FACT_CLEAR,
	FACT_CONFIRM,
	FACT_EDIT,
	FACT_NOT_SET,
	FACT_SAVE,
	FACT_SOURCE_LINK,
	FACT_SOURCE_PLACEHOLDER,
	FACT_UNVERIFIED,
	FACT_VALUE_PLACEHOLDER,
	FACTS_TITLE,
	FIELD_LABEL_LABEL,
	FIELD_PREFILL_LABEL,
	FIELD_PREFILL_NONE,
	FIELD_REQUIRED_LABEL,
	FIELD_TYPE_LABEL,
	factVerifiedBy,
	INSPECTION_NAME_LABEL,
	INSPECTION_NOTE_LABEL,
	INSPECTION_WHEN_LABEL,
	INSPECTIONS_EMPTY,
	INSPECTIONS_TITLE,
	PREREQUISITES_EMPTY,
	PREREQUISITES_TITLE,
	REMOVE,
	REMOVE_FIELD,
	REMOVE_FIELD_BODY,
	removeFieldTitle,
	SAVE_DOCUMENTS,
	SAVE_INSPECTIONS,
	WORKSHEET_DESCRIPTION,
	WORKSHEET_EMPTY,
	WORKSHEET_TITLE,
} from "./permits-copy";

type Playbook = RouterOutputs["permits"]["playbook"];
type Facts = Playbook["facts"];
type Fact = NonNullable<Facts["neededWhen"]>;
type RequiredDocument = Facts["requiredDocuments"][number];
type InspectionEntry = Facts["inspections"][number];
type WorksheetField = Playbook["worksheetTemplate"][number];

function permitsErrorMessage(error: { message: string }): string {
	return error.message;
}

function FactRow({
	label,
	fact,
	verifiedByName,
	pending,
	onSave,
	onVerify,
	onClear,
}: {
	label: string;
	fact: Fact | null;
	verifiedByName: string | null;
	pending: boolean;
	onSave: (value: string, sourceUrl: string | null) => void;
	onVerify: () => void;
	onClear: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draftValue, setDraftValue] = useState(fact?.value ?? "");
	const [draftSource, setDraftSource] = useState(fact?.sourceUrl ?? "");

	const startEditing = () => {
		setDraftValue(fact?.value ?? "");
		setDraftSource(fact?.sourceUrl ?? "");
		setEditing(true);
	};

	const save = () => {
		if (draftValue.trim() === "") return;
		onSave(draftValue.trim(), draftSource.trim() || null);
		setEditing(false);
	};

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-2.5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="font-medium text-sm">{label}</span>
				{fact ? (
					fact.verifiedById ? (
						<Badge variant="outline">
							<Icon icon={Checkmark} data-icon="inline-start" />
							{factVerifiedBy(verifiedByName ?? "someone")}
						</Badge>
					) : (
						<Badge variant="outline">{FACT_UNVERIFIED}</Badge>
					)
				) : null}
			</div>

			{editing ? (
				<div className="flex flex-col gap-2">
					<Textarea
						rows={2}
						autoFocus
						placeholder={FACT_VALUE_PLACEHOLDER}
						value={draftValue}
						disabled={pending}
						onChange={(event) => setDraftValue(event.target.value)}
					/>
					<Input
						placeholder={FACT_SOURCE_PLACEHOLDER}
						value={draftSource}
						disabled={pending}
						onChange={(event) => setDraftSource(event.target.value)}
					/>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							size="sm"
							disabled={pending || draftValue.trim() === ""}
							onClick={save}
						>
							{FACT_SAVE}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={pending}
							onClick={() => setEditing(false)}
						>
							{CANCEL}
						</Button>
					</div>
				</div>
			) : (
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
						{fact?.value ?? (
							<span className="text-muted-foreground">{FACT_NOT_SET}</span>
						)}
					</p>
					<div className="flex shrink-0 items-center gap-1.5">
						{fact?.sourceUrl ? (
							<Button type="button" variant="ghost" size="sm" asChild>
								<a href={fact.sourceUrl} target="_blank" rel="noreferrer">
									<Icon icon={Launch} data-icon="inline-start" />
									{FACT_SOURCE_LINK}
								</a>
							</Button>
						) : null}
						{fact && !fact.verifiedById ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={pending}
								onClick={onVerify}
							>
								{FACT_CONFIRM}
							</Button>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={pending}
							onClick={startEditing}
						>
							{FACT_EDIT}
						</Button>
						{fact ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={pending}
								onClick={onClear}
							>
								{FACT_CLEAR}
							</Button>
						) : null}
					</div>
				</div>
			)}
		</div>
	);
}

function DocumentsEditor({
	documents,
	pending,
	onSave,
}: {
	documents: RequiredDocument[];
	pending: boolean;
	onSave: (documents: RequiredDocument[]) => void;
}) {
	const [draft, setDraft] = useState<RequiredDocument[]>(documents);

	const dirty = JSON.stringify(draft) !== JSON.stringify(documents);

	const updateRow = (index: number, patch: Partial<RequiredDocument>) => {
		setDraft((prev) =>
			prev.map((row, rowIndex) =>
				rowIndex === index ? { ...row, ...patch } : row,
			),
		);
	};

	const addRow = () => {
		setDraft((prev) => [
			...prev,
			{
				key: uniqueWorksheetFieldKey(
					"document",
					prev.map((row) => row.key),
				),
				label: "",
				reusable: false,
				sourceUrl: null,
			},
		]);
	};

	return (
		<div className="flex flex-col gap-2">
			{draft.length === 0 ? (
				<p className="text-muted-foreground text-sm">{DOCUMENTS_EMPTY}</p>
			) : (
				draft.map((row, index) => (
					<div
						key={row.key}
						className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
					>
						<Input
							aria-label={DOCUMENT_LABEL_LABEL}
							placeholder={DOCUMENT_LABEL_LABEL}
							className="min-w-0 flex-1"
							value={row.label}
							disabled={pending}
							onChange={(event) =>
								updateRow(index, {
									label: event.target.value,
									key: uniqueWorksheetFieldKey(
										event.target.value || "document",
										draft
											.filter((_, otherIndex) => otherIndex !== index)
											.map((other) => other.key),
									),
								})
							}
						/>
						<Input
							aria-label={DOCUMENT_SOURCE_LABEL}
							placeholder={DOCUMENT_SOURCE_LABEL}
							className="min-w-0 flex-1"
							value={row.sourceUrl ?? ""}
							disabled={pending}
							onChange={(event) =>
								updateRow(index, {
									sourceUrl: event.target.value.trim() || null,
								})
							}
						/>
						<div className="flex shrink-0 items-center gap-1.5">
							<Switch
								checked={row.reusable}
								disabled={pending}
								onCheckedChange={(reusable) => updateRow(index, { reusable })}
							/>
							<span className="text-muted-foreground text-xs">
								{DOCUMENT_REUSABLE_LABEL}
							</span>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending}
							onClick={() =>
								setDraft((prev) =>
									prev.filter((_, rowIndex) => rowIndex !== index),
								)
							}
						>
							<Icon icon={TrashCan} />
							<span className="sr-only">{REMOVE}</span>
						</Button>
					</div>
				))
			)}

			<div className="flex items-center gap-2">
				<Button type="button" variant="outline" size="sm" onClick={addRow}>
					<Icon icon={Add} data-icon="inline-start" />
					{ADD_DOCUMENT}
				</Button>
				<Button
					type="button"
					size="sm"
					disabled={
						!dirty || pending || draft.some((row) => row.label.trim() === "")
					}
					onClick={() => onSave(draft)}
				>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{SAVE_DOCUMENTS}
				</Button>
			</div>
		</div>
	);
}

type DraftInspection = InspectionEntry & { uiKey: string };

function toDraftInspections(inspections: InspectionEntry[]): DraftInspection[] {
	return inspections.map((entry) => ({ ...entry, uiKey: crypto.randomUUID() }));
}

function fromDraftInspections(draft: DraftInspection[]): InspectionEntry[] {
	return draft.map(({ uiKey, ...entry }) => entry);
}

function InspectionsEditor({
	inspections,
	pending,
	onSave,
}: {
	inspections: InspectionEntry[];
	pending: boolean;
	onSave: (inspections: InspectionEntry[]) => void;
}) {
	const [draft, setDraft] = useState<DraftInspection[]>(() =>
		toDraftInspections(inspections),
	);

	const dirty =
		JSON.stringify(fromDraftInspections(draft)) !== JSON.stringify(inspections);

	const updateRow = (index: number, patch: Partial<InspectionEntry>) => {
		setDraft((prev) =>
			prev.map((row, rowIndex) =>
				rowIndex === index ? { ...row, ...patch } : row,
			),
		);
	};

	return (
		<div className="flex flex-col gap-2">
			{draft.length === 0 ? (
				<p className="text-muted-foreground text-sm">{INSPECTIONS_EMPTY}</p>
			) : (
				draft.map((row, index) => (
					<div
						key={row.uiKey}
						className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
					>
						<Input
							aria-label={INSPECTION_NAME_LABEL}
							placeholder={INSPECTION_NAME_LABEL}
							className="min-w-0 flex-1"
							value={row.name}
							disabled={pending}
							onChange={(event) =>
								updateRow(index, { name: event.target.value })
							}
						/>
						<Input
							aria-label={INSPECTION_WHEN_LABEL}
							placeholder={INSPECTION_WHEN_LABEL}
							className="min-w-0 flex-1"
							value={row.when ?? ""}
							disabled={pending}
							onChange={(event) =>
								updateRow(index, { when: event.target.value.trim() || null })
							}
						/>
						<Input
							aria-label={INSPECTION_NOTE_LABEL}
							placeholder={INSPECTION_NOTE_LABEL}
							className="min-w-0 flex-1"
							value={row.criticalNote ?? ""}
							disabled={pending}
							onChange={(event) =>
								updateRow(index, {
									criticalNote: event.target.value.trim() || null,
								})
							}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled={pending}
							onClick={() =>
								setDraft((prev) =>
									prev.filter((_, rowIndex) => rowIndex !== index),
								)
							}
						>
							<Icon icon={TrashCan} />
							<span className="sr-only">{REMOVE}</span>
						</Button>
					</div>
				))
			)}

			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						setDraft((prev) => [
							...prev,
							{
								uiKey: crypto.randomUUID(),
								name: "",
								when: null,
								criticalNote: null,
							},
						])
					}
				>
					<Icon icon={Add} data-icon="inline-start" />
					{ADD_INSPECTION}
				</Button>
				<Button
					type="button"
					size="sm"
					disabled={
						!dirty || pending || draft.some((row) => row.name.trim() === "")
					}
					onClick={() => onSave(fromDraftInspections(draft))}
				>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{SAVE_INSPECTIONS}
				</Button>
			</div>
		</div>
	);
}

function WorksheetTemplateEditor({
	fields,
	pending,
	onSave,
}: {
	fields: WorksheetField[];
	pending: boolean;
	onSave: (fields: WorksheetField[]) => void;
}) {
	const [draft, setDraft] = useState<WorksheetField[]>(fields);
	const [removeTarget, setRemoveTarget] = useState<WorksheetField | null>(null);
	const [newLabel, setNewLabel] = useState("");

	const dirty = JSON.stringify(draft) !== JSON.stringify(fields);

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= draft.length) return;
		const next = [...draft];
		const [moved] = next.splice(index, 1);
		if (!moved) return;
		next.splice(target, 0, moved);
		setDraft(next);
	};

	const updateField = (index: number, patch: Partial<WorksheetField>) => {
		setDraft((prev) =>
			prev.map((field, fieldIndex) =>
				fieldIndex === index ? { ...field, ...patch } : field,
			),
		);
	};

	const addField = () => {
		const label = newLabel.trim();
		if (!label) return;
		setDraft((prev) => [
			...prev,
			{
				key: uniqueWorksheetFieldKey(
					label,
					prev.map((field) => field.key),
				),
				label,
				type: "TEXT",
				prefill: null,
				required: false,
			},
		]);
		setNewLabel("");
	};

	return (
		<div className="flex flex-col gap-2">
			{draft.length === 0 ? (
				<p className="text-muted-foreground text-sm">{WORKSHEET_EMPTY}</p>
			) : (
				draft.map((field, index) => (
					<div
						key={field.key}
						className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
					>
						<Input
							aria-label={FIELD_LABEL_LABEL}
							className="min-w-0 flex-1"
							value={field.label}
							disabled={pending}
							onChange={(event) =>
								updateField(index, { label: event.target.value })
							}
						/>
						<Select
							value={field.type}
							disabled={pending}
							onValueChange={(next) =>
								updateField(index, { type: next as WorksheetFieldType })
							}
						>
							<SelectTrigger
								aria-label={FIELD_TYPE_LABEL}
								className="w-32 shrink-0"
							>
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
						<Select
							value={field.prefill ?? "none"}
							disabled={pending}
							onValueChange={(next) =>
								updateField(index, {
									prefill:
										next === "none" ? null : (next as WorksheetPrefillKey),
								})
							}
						>
							<SelectTrigger
								aria-label={FIELD_PREFILL_LABEL}
								className="w-40 shrink-0"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">{FIELD_PREFILL_NONE}</SelectItem>
								{WORKSHEET_PREFILL_KEYS.map((key) => (
									<SelectItem key={key} value={key}>
										{WORKSHEET_PREFILL_LABEL[key]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className="flex shrink-0 items-center gap-1.5">
							<Switch
								checked={field.required}
								disabled={pending}
								onCheckedChange={(required) => updateField(index, { required })}
							/>
							<span className="text-muted-foreground text-xs">
								{FIELD_REQUIRED_LABEL}
							</span>
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
							disabled={pending || index === draft.length - 1}
							onClick={() => move(index, 1)}
						>
							<Icon icon={ArrowDown} />
							<span className="sr-only">Move {field.label} down</span>
						</Button>
						<AlertDialog
							open={removeTarget?.key === field.key}
							onOpenChange={(next) => {
								if (!next) setRemoveTarget(null);
							}}
						>
							<AlertDialogTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									disabled={pending}
									onClick={() => setRemoveTarget(field)}
								>
									<Icon icon={TrashCan} />
									<span className="sr-only">{REMOVE_FIELD}</span>
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{removeFieldTitle(field.label)}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{REMOVE_FIELD_BODY}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{CANCEL}</AlertDialogCancel>
									<AlertDialogAction
										variant="destructive"
										onClick={() => {
											setDraft((prev) =>
												prev.filter((entry) => entry.key !== field.key),
											);
											setRemoveTarget(null);
										}}
									>
										{REMOVE_FIELD}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				))
			)}

			<div className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
				<Input
					placeholder={FIELD_LABEL_LABEL}
					className="min-w-0 flex-1"
					value={newLabel}
					disabled={pending}
					onChange={(event) => setNewLabel(event.target.value)}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={pending || newLabel.trim() === ""}
					onClick={addField}
				>
					<Icon icon={Add} data-icon="inline-start" />
					{ADD_FIELD}
				</Button>
			</div>

			<div>
				<Button
					type="button"
					size="sm"
					disabled={!dirty || pending}
					onClick={() => onSave(draft)}
				>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{FACT_SAVE}
				</Button>
			</div>
		</div>
	);
}

export function PlaybookEditor({
	jurisdictionId,
	permitType,
	typeLabel,
}: {
	jurisdictionId: string;
	permitType: PermitType;
	typeLabel: string | undefined;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [addingPrerequisite, setAddingPrerequisite] = useState(false);

	const users = useQuery(trpc.users.list.queryOptions());
	const playbookQuery = useQuery(
		trpc.permits.playbook.queryOptions({
			jurisdictionId,
			permitType,
			typeLabel,
		}),
	);

	const playbook = playbookQuery.data;

	const invalidate = () => {
		if (!playbook) return;
		void cache.playbook(playbook.id);
	};

	const setFact = useMutation(
		trpc.permits.setPlaybookFact.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);
	const verifyFact = useMutation(
		trpc.permits.verifyPlaybookFact.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);
	const clearFact = useMutation(
		trpc.permits.clearPlaybookFact.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);
	const setDocuments = useMutation(
		trpc.permits.setPlaybookDocuments.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);
	const setInspections = useMutation(
		trpc.permits.setPlaybookInspections.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);
	const setWorksheetTemplate = useMutation(
		trpc.permits.setWorksheetTemplate.mutationOptions({
			onSuccess: invalidate,
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);

	if (!playbook) {
		return (
			<div className="flex justify-center py-8">
				<Spinner />
			</div>
		);
	}

	const nameFor = (userId: string | null) =>
		userId
			? (users.data?.find((user) => user.id === userId)?.name ?? null)
			: null;

	const saveFact =
		(path: FactPath | `prerequisites.${number}`) =>
		(value: string, sourceUrl: string | null) =>
			setFact.mutate({
				playbookId: playbook.id,
				factPath: path,
				value,
				sourceUrl,
			});

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>{FACTS_TITLE}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{FACT_PATHS.map((path) => (
						<FactRow
							key={path}
							label={FACT_PATH_LABEL[path]}
							fact={playbook.facts[path]}
							verifiedByName={nameFor(
								playbook.facts[path]?.verifiedById ?? null,
							)}
							pending={
								setFact.isPending || verifyFact.isPending || clearFact.isPending
							}
							onSave={saveFact(path)}
							onVerify={() =>
								verifyFact.mutate({ playbookId: playbook.id, factPath: path })
							}
							onClear={() =>
								clearFact.mutate({ playbookId: playbook.id, factPath: path })
							}
						/>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{PREREQUISITES_TITLE}</CardTitle>
					<CardAction>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setAddingPrerequisite(true)}
						>
							<Icon icon={Add} data-icon="inline-start" />
							{ADD_PREREQUISITE}
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{playbook.facts.prerequisites.length === 0 && !addingPrerequisite ? (
						<p className="text-muted-foreground text-sm">
							{PREREQUISITES_EMPTY}
						</p>
					) : null}
					{playbook.facts.prerequisites.map((fact, index) => (
						<FactRow
							key={`${fact.value}:${fact.sourceUrl ?? ""}`}
							label={`Prerequisite ${index + 1}`}
							fact={fact}
							verifiedByName={nameFor(fact.verifiedById)}
							pending={
								setFact.isPending || verifyFact.isPending || clearFact.isPending
							}
							onSave={saveFact(`prerequisites.${index}`)}
							onVerify={() =>
								verifyFact.mutate({
									playbookId: playbook.id,
									factPath: `prerequisites.${index}`,
								})
							}
							onClear={() =>
								clearFact.mutate({
									playbookId: playbook.id,
									factPath: `prerequisites.${index}`,
								})
							}
						/>
					))}
					{addingPrerequisite ? (
						<FactRow
							label={`Prerequisite ${playbook.facts.prerequisites.length + 1}`}
							fact={null}
							verifiedByName={null}
							pending={setFact.isPending}
							onSave={(value, sourceUrl) => {
								setFact.mutate(
									{
										playbookId: playbook.id,
										factPath: `prerequisites.${playbook.facts.prerequisites.length}`,
										value,
										sourceUrl,
									},
									{ onSuccess: () => setAddingPrerequisite(false) },
								);
							}}
							onVerify={() => undefined}
							onClear={() => setAddingPrerequisite(false)}
						/>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{DOCUMENTS_TITLE}</CardTitle>
				</CardHeader>
				<CardContent>
					<DocumentsEditor
						key={JSON.stringify(playbook.facts.requiredDocuments)}
						documents={playbook.facts.requiredDocuments}
						pending={setDocuments.isPending}
						onSave={(documents) =>
							setDocuments.mutate({ playbookId: playbook.id, documents })
						}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{INSPECTIONS_TITLE}</CardTitle>
				</CardHeader>
				<CardContent>
					<InspectionsEditor
						key={JSON.stringify(playbook.facts.inspections)}
						inspections={playbook.facts.inspections}
						pending={setInspections.isPending}
						onSave={(inspections) =>
							setInspections.mutate({ playbookId: playbook.id, inspections })
						}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{WORKSHEET_TITLE}</CardTitle>
					<CardDescription>{WORKSHEET_DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent>
					<WorksheetTemplateEditor
						key={JSON.stringify(playbook.worksheetTemplate)}
						fields={playbook.worksheetTemplate}
						pending={setWorksheetTemplate.isPending}
						onSave={(fields) =>
							setWorksheetTemplate.mutate({ playbookId: playbook.id, fields })
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
