"use client";

import Attachment from "@carbon/icons-react/es/Attachment";
import Upload from "@carbon/icons-react/es/Upload";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type PermitDocument = RouterOutputs["permits"]["byId"]["documents"][number];

const UNVERIFIED_TOOLTIP =
	"Janus drafted this requirement. Confirm it in Settings > Permits.";

export function ChecklistSection({
	permitId,
	documents,
}: {
	permitId: string;
	documents: PermitDocument[];
}) {
	if (documents.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-muted-foreground text-sm">Checklist</h3>
			<div className="flex flex-col gap-1.5">
				{documents.map((doc) => (
					<ChecklistRow key={doc.id} permitId={permitId} doc={doc} />
				))}
			</div>
		</div>
	);
}

function ChecklistRow({
	permitId,
	doc,
}: {
	permitId: string;
	doc: PermitDocument;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const lockerList = useQuery(trpc.permits.lockerList.queryOptions());

	const attach = useMutation(
		trpc.permits.attachChecklistDocument.mutationOptions({
			onSuccess: () => cache.permit(permitId, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const attached = Boolean(doc.filePath || doc.lockerDocumentId);

	const viewHref = doc.filePath
		? `/api/permits/document/${doc.id}`
		: doc.lockerDocumentId
			? `/api/permits/locker/${doc.lockerDocumentId}`
			: null;

	const upload = async (file: File) => {
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("permitId", permitId);
			formData.append("slotKey", doc.slotKey);
			const response = await fetch("/api/permits/document", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(body?.error ?? "The file could not be uploaded.");
			}
			await cache.permit(permitId, { settle: "record" });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed.");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
			<span className="min-w-0 flex-1 truncate text-sm">{doc.label}</span>

			<Badge variant={attached ? "secondary" : "outline"}>
				{attached ? "Attached" : "Missing"}
			</Badge>

			{doc.sourceVerified === false ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="warning">Unverified</Badge>
					</TooltipTrigger>
					<TooltipContent>{UNVERIFIED_TOOLTIP}</TooltipContent>
				</Tooltip>
			) : null}

			{viewHref ? (
				<Button asChild variant="ghost" size="sm">
					<a href={viewHref} target="_blank" rel="noreferrer">
						View
					</a>
				</Button>
			) : null}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={attach.isPending}
					>
						<Icon icon={Attachment} data-icon="inline-start" />
						From locker
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{(lockerList.data ?? []).length === 0 ? (
						<DropdownMenuItem disabled>The locker is empty.</DropdownMenuItem>
					) : (
						lockerList.data?.map((item) => (
							<DropdownMenuItem
								key={item.id}
								onSelect={() =>
									attach.mutate({
										permitId,
										slotKey: doc.slotKey,
										lockerDocumentId: item.id,
									})
								}
							>
								{item.label}
							</DropdownMenuItem>
						))
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={uploading}
				onClick={() => fileInputRef.current?.click()}
			>
				{uploading ? (
					<Spinner data-icon="inline-start" />
				) : (
					<Icon icon={Upload} data-icon="inline-start" />
				)}
				Upload
			</Button>
			<input
				ref={fileInputRef}
				type="file"
				className="hidden"
				accept="image/png,image/jpeg,image/webp,application/pdf"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void upload(file);
				}}
			/>
		</div>
	);
}
