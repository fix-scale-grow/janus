"use client";

import Attachment from "@carbon/icons-react/es/Attachment";
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
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	LOCKER_KIND_LABEL,
	LOCKER_KINDS,
	type LockerKind,
} from "@/lib/permits/permit-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	LOCKER_DELETE,
	LOCKER_DELETE_BODY,
	LOCKER_DELETE_ERROR,
	LOCKER_DESCRIPTION,
	LOCKER_EMPTY,
	LOCKER_KIND_LABEL_TEXT,
	LOCKER_LABEL_LABEL,
	LOCKER_OPEN,
	LOCKER_TITLE,
	LOCKER_UPLOAD,
	LOCKER_UPLOAD_ERROR,
	lockerDeleteTitle,
	lockerReferencingNote,
} from "./permits-copy";

type LockerDocument = RouterOutputs["permits"]["lockerList"][number];

function lockerUrl(id: string): string {
	return `/api/permits/locker/${id}`;
}

function LockerRow({
	document,
	onRenamed,
	onDeleted,
}: {
	document: LockerDocument;
	onRenamed: () => Promise<void>;
	onDeleted: () => Promise<void>;
}) {
	const trpc = useTRPC();
	const [label, setLabel] = useState(document.label);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const rename = useMutation(
		trpc.permits.lockerRename.mutationOptions({
			onSuccess: () => onRenamed(),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const deleteFile = useMutation({
		mutationFn: async () => {
			const response = await fetch(lockerUrl(document.id), {
				method: "DELETE",
			});
			if (!response.ok) throw new Error(LOCKER_DELETE_ERROR);
		},
		onSuccess: () => onDeleted(),
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 last:border-b-0">
			<Input
				aria-label={LOCKER_LABEL_LABEL}
				className="h-8 min-w-0 flex-1"
				value={label}
				onChange={(event) => setLabel(event.target.value)}
				onBlur={(event) => {
					const trimmed = event.target.value.trim();
					if (!trimmed || trimmed === document.label) {
						setLabel(document.label);
						return;
					}
					rename.mutate({ lockerDocumentId: document.id, label: trimmed });
				}}
			/>

			<Select
				value={document.kind}
				onValueChange={(kind) =>
					rename.mutate({
						lockerDocumentId: document.id,
						label: document.label,
						kind: kind as LockerKind,
					})
				}
			>
				<SelectTrigger
					aria-label={LOCKER_KIND_LABEL_TEXT}
					className="h-8 w-40 shrink-0"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{LOCKER_KINDS.map((kind) => (
						<SelectItem key={kind} value={kind}>
							{LOCKER_KIND_LABEL[kind]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<span className="shrink-0 text-muted-foreground text-xs">
				{lockerReferencingNote(document.referencingCount)}
			</span>

			<Button type="button" variant="ghost" size="sm" asChild>
				<a href={lockerUrl(document.id)} target="_blank" rel="noreferrer">
					<Icon icon={Attachment} data-icon="inline-start" />
					{LOCKER_OPEN}
				</a>
			</Button>

			<AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
				<AlertDialogTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						disabled={deleteFile.isPending}
					>
						<Icon icon={TrashCan} />
						<span className="sr-only">{LOCKER_DELETE}</span>
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{lockerDeleteTitle(document.label)}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{LOCKER_DELETE_BODY}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => deleteFile.mutate()}
						>
							{LOCKER_DELETE}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function LockerUpload({ onUploaded }: { onUploaded: () => Promise<void> }) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [label, setLabel] = useState("");
	const [kind, setKind] = useState<LockerKind>("OTHER");
	const labelId = useId();

	const upload = useMutation({
		mutationFn: async (file: File) => {
			const body = new FormData();
			body.set("file", file);
			body.set("label", label.trim());
			body.set("kind", kind);
			const response = await fetch("/api/permits/locker", {
				method: "POST",
				body,
			});
			if (!response.ok) {
				const data = await response.json().catch(() => null);
				throw new Error(data?.error ?? LOCKER_UPLOAD_ERROR);
			}
		},
		onSuccess: async () => {
			setLabel("");
			setKind("OTHER");
			if (fileInputRef.current) fileInputRef.current.value = "";
			await onUploaded();
			toast.success("File uploaded.");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const submit = () => {
		const file = fileInputRef.current?.files?.[0];
		if (!file || !label.trim()) return;
		upload.mutate(file);
	};

	return (
		<div className="flex flex-wrap items-end gap-2 p-4">
			<Field className="min-w-0 flex-1">
				<FieldLabel htmlFor={labelId}>{LOCKER_LABEL_LABEL}</FieldLabel>
				<Input
					id={labelId}
					value={label}
					onChange={(event) => setLabel(event.target.value)}
				/>
			</Field>

			<Select
				value={kind}
				onValueChange={(next) => setKind(next as LockerKind)}
			>
				<SelectTrigger
					aria-label={LOCKER_KIND_LABEL_TEXT}
					className="w-40 shrink-0"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{LOCKER_KINDS.map((value) => (
						<SelectItem key={value} value={value}>
							{LOCKER_KIND_LABEL[value]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Input
				ref={fileInputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,application/pdf"
				className="w-56 shrink-0"
			/>

			<Button
				type="button"
				size="sm"
				disabled={upload.isPending || !label.trim()}
				onClick={submit}
			>
				{upload.isPending ? <Spinner data-icon="inline-start" /> : null}
				{LOCKER_UPLOAD}
			</Button>
		</div>
	);
}

export function LockerManager() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const locker = useQuery(trpc.permits.lockerList.queryOptions());

	const refresh = () => cache.locker();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{LOCKER_TITLE}</CardTitle>
				<CardDescription>{LOCKER_DESCRIPTION}</CardDescription>
			</CardHeader>

			<div className="border-t">
				{locker.data && locker.data.length === 0 ? (
					<p className="p-4 text-muted-foreground text-sm">{LOCKER_EMPTY}</p>
				) : (
					locker.data?.map((document) => (
						<LockerRow
							key={document.id}
							document={document}
							onRenamed={refresh}
							onDeleted={refresh}
						/>
					))
				)}
			</div>

			<div className="border-t">
				<LockerUpload onUploaded={refresh} />
			</div>
		</Card>
	);
}
