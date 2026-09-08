"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import type { FormFieldType } from "@crm/db/enums";
import {
	FORM_FIELD_OPTION_LABEL_MAX,
	FORM_FIELD_OPTIONS_MAX,
	FORMS,
	formFieldOptions,
	formFieldTypeEnum,
} from "@crm/db/forms";
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
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Combobox } from "@crm/ui/components/combobox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { FormEmbed } from "./form-embed";
import { FormPreview, type PreviewField } from "./form-preview";
import { FormSubmissions } from "./form-submissions";
import {
	ACTIVE_LABEL,
	ADD_FIELD,
	ADD_OPTION,
	BACK,
	BUTTON_LABEL_LABEL,
	CANCEL,
	CONFIRMATION_LABEL,
	CONTACT_FIELD_LABEL,
	CONTACT_FIELD_NONE,
	CONTACT_FIELD_PLACEHOLDER,
	CREATE_LEAD_HELP,
	CREATE_LEAD_LABEL,
	DISCARD_FIELDS,
	FIELDS_NOTE,
	FIELDS_TITLE,
	INTRO_LABEL,
	LABEL_LABEL,
	NAME_LABEL,
	NEED_LABELS,
	NEED_ONE_EMAIL,
	NOTIFY_EMAILS_HELP,
	NOTIFY_EMAILS_LABEL,
	NOTIFY_EMAILS_PLACEHOLDER,
	REMOVE_FIELD,
	REMOVE_FORM,
	REMOVE_FORM_BODY,
	REQUIRED_LABEL,
	removeFormTitle,
	SAVE_FIELDS,
	SETTINGS_TITLE,
	SUBMISSIONS_TITLE,
	TAB_BUILD,
	TAB_EMBED,
	TAB_SUBMISSIONS,
	TOO_MANY_FIELDS,
	TYPE_LABEL,
	TYPE_LABEL_FIELD,
} from "./forms-copy";

type Form = RouterOutputs["forms"]["byId"];
type ContactField = RouterOutputs["fields"]["list"][number];

type ServerField = {
	id: string;
	type: FormFieldType;
	label: string;
	required: boolean;
	options: unknown;
	contactFieldKey: string | null;
};

type FieldOption = { id: string; value: string };

type EditableField = {
	key: string;
	serverId?: string;
	type: FormFieldType;
	label: string;
	required: boolean;
	options: FieldOption[];
	contactFieldKey: string | null;
};

function fromServerFields(fields: ServerField[]): EditableField[] {
	return fields.map((field) => {
		const parsedOptions = formFieldOptions.safeParse(field.options);
		return {
			key: field.id,
			serverId: field.id,
			type: field.type,
			label: field.label,
			required: field.required,
			options: parsedOptions.success
				? parsedOptions.data.map((value) => ({
						id: crypto.randomUUID(),
						value,
					}))
				: [],
			contactFieldKey: field.contactFieldKey,
		};
	});
}

function newField(): EditableField {
	return {
		key: crypto.randomUUID(),
		type: "TEXT",
		label: "",
		required: false,
		options: [],
		contactFieldKey: null,
	};
}

function fieldsError(fields: EditableField[]): string | null {
	if (fields.length === 0 || fields.length > FORMS.field.maxFields) {
		return TOO_MANY_FIELDS;
	}
	if (fields.filter((field) => field.type === "EMAIL").length !== 1) {
		return NEED_ONE_EMAIL;
	}
	if (fields.some((field) => field.label.trim() === "")) {
		return NEED_LABELS;
	}
	return null;
}

type SettingsDraft = {
	name: string;
	intro: string;
	buttonLabel: string;
	confirmation: string;
	createLead: boolean;
	notifyEmails: string;
};

function settingsFromForm(form: Form): SettingsDraft {
	return {
		name: form.name,
		intro: form.intro ?? "",
		buttonLabel: form.buttonLabel,
		confirmation: form.confirmation,
		createLead: form.createLead,
		notifyEmails: form.notifyEmails ?? "",
	};
}

function FieldOptionsEditor({
	field,
	onChange,
}: {
	field: EditableField;
	onChange: (options: FieldOption[]) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			{field.options.map((option, index) => (
				<div className="flex items-center gap-1.5" key={option.id}>
					<Input
						aria-label={`Option ${index + 1}`}
						className="h-8 flex-1"
						maxLength={FORM_FIELD_OPTION_LABEL_MAX}
						value={option.value}
						onChange={(event) =>
							onChange(
								field.options.map((current) =>
									current.id === option.id
										? { ...current, value: event.target.value }
										: current,
								),
							)
						}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={() =>
							onChange(
								field.options.filter((current) => current.id !== option.id),
							)
						}
					>
						<Icon icon={TrashCan} />
						<span className="sr-only">Remove option</span>
					</Button>
				</div>
			))}

			<Button
				type="button"
				variant="outline"
				size="xs"
				className="self-start"
				disabled={field.options.length >= FORM_FIELD_OPTIONS_MAX}
				onClick={() =>
					onChange([...field.options, { id: crypto.randomUUID(), value: "" }])
				}
			>
				<Icon icon={Add} data-icon="inline-start" />
				{ADD_OPTION}
			</Button>
		</div>
	);
}

function FormFieldRow({
	field,
	contactOptions,
	onChange,
	onRemove,
}: {
	field: EditableField;
	contactOptions: { value: string; label: string }[];
	onChange: (next: EditableField) => void;
	onRemove: () => void;
}) {
	return (
		<div className="flex flex-1 flex-col gap-2 border-b px-4 py-3 last:border-b-0">
			<div className="flex items-center gap-2">
				<Input
					aria-label={LABEL_LABEL}
					className="h-8 min-w-0 flex-1"
					value={field.label}
					maxLength={FORMS.field.labelMax}
					onChange={(event) =>
						onChange({ ...field, label: event.target.value })
					}
				/>

				<Select
					value={field.type}
					onValueChange={(type) =>
						onChange({ ...field, type: type as FormFieldType })
					}
				>
					<SelectTrigger
						aria-label={TYPE_LABEL_FIELD}
						className="h-8 w-32 shrink-0"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{formFieldTypeEnum.options.map((type) => (
							<SelectItem key={type} value={type}>
								{TYPE_LABEL[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="flex shrink-0 items-center gap-1.5">
					<Switch
						aria-label={REQUIRED_LABEL}
						checked={field.required}
						onCheckedChange={(required) => onChange({ ...field, required })}
					/>
					<span className="text-muted-foreground text-xs">
						{REQUIRED_LABEL}
					</span>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="shrink-0"
					onClick={onRemove}
				>
					<Icon icon={TrashCan} />
					<span className="sr-only">{REMOVE_FIELD}</span>
				</Button>
			</div>

			{field.type === "SELECT" ? (
				<FieldOptionsEditor
					field={field}
					onChange={(options) => onChange({ ...field, options })}
				/>
			) : null}

			<div className="flex items-center gap-2">
				<span className="shrink-0 text-muted-foreground text-xs">
					{CONTACT_FIELD_LABEL}
				</span>
				<Combobox
					size="sm"
					className="w-full max-w-72"
					placeholder={CONTACT_FIELD_PLACEHOLDER}
					value={field.contactFieldKey ?? ""}
					onValueChange={(value) =>
						onChange({ ...field, contactFieldKey: value === "" ? null : value })
					}
					options={[
						{ value: "", label: CONTACT_FIELD_NONE },
						...contactOptions,
					]}
				/>
			</div>
		</div>
	);
}

function FormBuilder({
	formId,
	form,
	contactFields,
}: {
	formId: string;
	form: Form;
	contactFields: ContactField[];
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [settings, setSettings] = useState<SettingsDraft>(() =>
		settingsFromForm(form),
	);
	const [committed, setCommitted] = useState<SettingsDraft>(() =>
		settingsFromForm(form),
	);

	const [fields, setFields] = useState<EditableField[]>(() =>
		fromServerFields(form.fields),
	);
	const [savedFields, setSavedFields] = useState<EditableField[]>(() =>
		fromServerFields(form.fields),
	);

	const update = useMutation(
		trpc.forms.update.mutationOptions({
			onSuccess: () => cache.forms(formId),
			onError: (error) => toast.error(error.message),
		}),
	);

	const updateFields = useMutation(
		trpc.forms.updateFields.mutationOptions({
			onSuccess: (updated) => {
				const next = fromServerFields(updated.fields);
				setFields(next);
				setSavedFields(next);
				void cache.forms(formId);
				toast.success("Fields saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitName = (value: string) => {
		if (committed.name === value) return;
		setCommitted((prev) => ({ ...prev, name: value }));
		update.mutate({ id: formId, data: { name: value } });
	};

	const commitIntro = (value: string) => {
		if (committed.intro === value) return;
		setCommitted((prev) => ({ ...prev, intro: value }));
		update.mutate({ id: formId, data: { intro: value.trim() || null } });
	};

	const commitButtonLabel = (value: string) => {
		if (value === "") {
			setSettings((prev) => ({ ...prev, buttonLabel: committed.buttonLabel }));
			return;
		}
		if (committed.buttonLabel === value) return;
		setCommitted((prev) => ({ ...prev, buttonLabel: value }));
		update.mutate({ id: formId, data: { buttonLabel: value } });
	};

	const commitConfirmation = (value: string) => {
		if (value === "") {
			setSettings((prev) => ({
				...prev,
				confirmation: committed.confirmation,
			}));
			return;
		}
		if (committed.confirmation === value) return;
		setCommitted((prev) => ({ ...prev, confirmation: value }));
		update.mutate({ id: formId, data: { confirmation: value } });
	};

	const commitCreateLead = (value: boolean) => {
		setCommitted((prev) => ({ ...prev, createLead: value }));
		update.mutate({ id: formId, data: { createLead: value } });
	};

	const commitNotifyEmails = (value: string) => {
		if (committed.notifyEmails === value) return;
		setCommitted((prev) => ({ ...prev, notifyEmails: value }));
		update.mutate({ id: formId, data: { notifyEmails: value.trim() || null } });
	};

	const contactOptions = contactFields.map((field) => ({
		value: field.key,
		label: field.label,
	}));

	const fieldsDirty = JSON.stringify(fields) !== JSON.stringify(savedFields);
	const error = fieldsError(fields);

	const previewFields: PreviewField[] = fields.map((field) => ({
		id: field.key,
		type: field.type,
		label: field.label,
		required: field.required,
		options: field.options.map((option) => option.value),
	}));

	const saveFields = () => {
		if (error) {
			toast.error(error);
			return;
		}
		updateFields.mutate({
			formId,
			fields: fields.map((field) => ({
				id: field.serverId,
				type: field.type,
				label: field.label.trim(),
				required: field.required,
				options:
					field.type === "SELECT"
						? field.options.map((option) => option.value).filter(Boolean)
						: undefined,
				contactFieldKey: field.contactFieldKey,
			})),
		});
	};

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
			<div className="flex flex-col gap-6">
				<Card>
					<CardHeader>
						<CardTitle>{SETTINGS_TITLE}</CardTitle>
					</CardHeader>
					<CardContent>
						<FieldGroup>
							<Field>
								<FieldLabel>{NAME_LABEL}</FieldLabel>
								<Input
									value={settings.name}
									onChange={(event) =>
										setSettings((prev) => ({
											...prev,
											name: event.target.value,
										}))
									}
									onBlur={(event) => {
										const trimmed = event.target.value.trim();
										if (trimmed === "") {
											setSettings((prev) => ({
												...prev,
												name: committed.name,
											}));
											return;
										}
										commitName(trimmed);
									}}
								/>
							</Field>

							<Field>
								<FieldLabel>{INTRO_LABEL}</FieldLabel>
								<Textarea
									rows={2}
									value={settings.intro}
									onChange={(event) =>
										setSettings((prev) => ({
											...prev,
											intro: event.target.value,
										}))
									}
									onBlur={(event) => commitIntro(event.target.value)}
								/>
							</Field>

							<div className="grid grid-cols-2 gap-3">
								<Field>
									<FieldLabel>{BUTTON_LABEL_LABEL}</FieldLabel>
									<Input
										value={settings.buttonLabel}
										onChange={(event) =>
											setSettings((prev) => ({
												...prev,
												buttonLabel: event.target.value,
											}))
										}
										onBlur={(event) =>
											commitButtonLabel(event.target.value.trim())
										}
									/>
								</Field>

								<Field>
									<div className="flex items-center justify-between gap-3">
										<FieldLabel>{CREATE_LEAD_LABEL}</FieldLabel>
										<Switch
											checked={settings.createLead}
											onCheckedChange={(createLead) => {
												setSettings((prev) => ({ ...prev, createLead }));
												commitCreateLead(createLead);
											}}
										/>
									</div>
									<FieldDescription>{CREATE_LEAD_HELP}</FieldDescription>
								</Field>
							</div>

							<Field>
								<FieldLabel>{CONFIRMATION_LABEL}</FieldLabel>
								<Textarea
									rows={2}
									value={settings.confirmation}
									onChange={(event) =>
										setSettings((prev) => ({
											...prev,
											confirmation: event.target.value,
										}))
									}
									onBlur={(event) =>
										commitConfirmation(event.target.value.trim())
									}
								/>
							</Field>

							<Field>
								<FieldLabel>{NOTIFY_EMAILS_LABEL}</FieldLabel>
								<Input
									placeholder={NOTIFY_EMAILS_PLACEHOLDER}
									value={settings.notifyEmails}
									onChange={(event) =>
										setSettings((prev) => ({
											...prev,
											notifyEmails: event.target.value,
										}))
									}
									onBlur={(event) => commitNotifyEmails(event.target.value)}
								/>
								<p className="text-muted-foreground text-xs">
									{NOTIFY_EMAILS_HELP}
								</p>
							</Field>
						</FieldGroup>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{FIELDS_TITLE}</CardTitle>
						<CardDescription>{FIELDS_NOTE}</CardDescription>
						<CardAction>
							<div className="flex items-center gap-2">
								{fieldsDirty ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={updateFields.isPending}
										onClick={() => setFields(savedFields)}
									>
										{DISCARD_FIELDS}
									</Button>
								) : null}
								<Button
									type="button"
									size="sm"
									disabled={!fieldsDirty || updateFields.isPending}
									onClick={saveFields}
								>
									{updateFields.isPending ? (
										<Spinner data-icon="inline-start" />
									) : null}
									{SAVE_FIELDS}
								</Button>
							</div>
						</CardAction>
					</CardHeader>

					<div className="border-t">
						<SortableList
							ids={fields.map((field) => field.key)}
							onReorder={(ids) => {
								const byKey = new Map(
									fields.map((field) => [field.key, field]),
								);
								setFields(
									ids
										.map((id) => byKey.get(id))
										.filter(
											(field): field is EditableField => field !== undefined,
										),
								);
							}}
						>
							{fields.map((field) => (
								<SortableItem
									key={field.key}
									id={field.key}
									label={field.label}
								>
									<FormFieldRow
										field={field}
										contactOptions={contactOptions}
										onChange={(next) =>
											setFields((prev) =>
												prev.map((current) =>
													current.key === next.key ? next : current,
												),
											)
										}
										onRemove={() =>
											setFields((prev) =>
												prev.filter((current) => current.key !== field.key),
											)
										}
									/>
								</SortableItem>
							))}
						</SortableList>
					</div>

					<div className="px-4 py-2.5">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={fields.length >= FORMS.field.maxFields}
							onClick={() => setFields((prev) => [...prev, newField()])}
						>
							<Icon icon={Add} data-icon="inline-start" />
							{ADD_FIELD}
						</Button>
					</div>
				</Card>
			</div>

			<FormPreview
				config={{
					name: settings.name,
					intro: settings.intro,
					buttonLabel: settings.buttonLabel,
					fields: previewFields,
				}}
			/>
		</div>
	);
}

export function FormEditor({
	formId,
	onBack,
}: {
	formId: string;
	onBack: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [tab, setTab] = useState("build");
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	const form = useQuery(trpc.forms.byId.queryOptions({ id: formId }));
	const contactFields = useQuery(
		trpc.fields.list.queryOptions({
			entity: "CONTACT",
			includeArchived: false,
		}),
	);

	const setActive = useMutation(
		trpc.forms.setActive.mutationOptions({
			onSuccess: (updated) => cache.forms(updated.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.forms.remove.mutationOptions({
			onSuccess: async () => {
				await cache.forms();
				toast.success("Form deleted.");
				onBack();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-1">
						<Button variant="ghost" size="icon-sm" onClick={onBack}>
							<Icon icon={ArrowLeft} />
							<span className="sr-only">{BACK}</span>
						</Button>
						{form.data?.name ?? ""}
					</div>
				</CardTitle>

				<CardAction>
					<div className="flex items-center gap-3">
						{form.data ? (
							<div className="flex items-center gap-1.5">
								<Switch
									checked={form.data.active}
									disabled={setActive.isPending}
									onCheckedChange={(active) =>
										setActive.mutate({ id: formId, active })
									}
								/>
								<span className="text-muted-foreground text-xs">
									{ACTIVE_LABEL}
								</span>
							</div>
						) : null}

						<AlertDialog
							open={confirmingRemove}
							onOpenChange={setConfirmingRemove}
						>
							<AlertDialogTrigger asChild>
								<Button type="button" variant="ghost" size="sm">
									{REMOVE_FORM}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{removeFormTitle(form.data?.name ?? "")}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{REMOVE_FORM_BODY}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{CANCEL}</AlertDialogCancel>
									<AlertDialogAction
										variant="destructive"
										onClick={() => remove.mutate({ id: formId })}
									>
										{REMOVE_FORM}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>

						<Tabs value={tab} onValueChange={setTab}>
							<TabsList>
								<TabsTrigger value="build">{TAB_BUILD}</TabsTrigger>
								<TabsTrigger value="embed">{TAB_EMBED}</TabsTrigger>
								<TabsTrigger value="submissions">{TAB_SUBMISSIONS}</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</CardAction>
			</CardHeader>

			<CardContent>
				{!form.data || !contactFields.data ? (
					<div className="flex justify-center py-12">
						<Spinner />
					</div>
				) : tab === "build" ? (
					<FormBuilder
						key={form.data.id}
						formId={formId}
						form={form.data}
						contactFields={contactFields.data}
					/>
				) : tab === "embed" ? (
					<FormEmbed formId={formId} formName={form.data.name} />
				) : (
					<>
						<h3 className="mb-3 font-medium text-sm">{SUBMISSIONS_TITLE}</h3>
						<FormSubmissions formId={formId} />
					</>
				)}
			</CardContent>
		</Card>
	);
}
