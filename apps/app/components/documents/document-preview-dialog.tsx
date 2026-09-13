"use client";

import Warning from "@carbon/icons-react/es/Warning";
import type { TemplatePurpose } from "@crm/db/enums";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SendDocumentRefs } from "@/components/documents/send-document-dialog";
import { useTRPC } from "@/lib/trpc/client";

export type PreviewKind = "estimate" | "invoice" | "contract";

function pdfBlobUrl(base64: string): string {
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export function DocumentPreviewDialog({
	open,
	onOpenChange,
	kind,
	documentId,
	entityLabel,
	purpose,
	refs,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: PreviewKind;
	documentId: string;
	entityLabel: string;
	purpose: TemplatePurpose;
	refs: SendDocumentRefs;
}) {
	const trpc = useTRPC();
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);

	const documentOptions =
		kind === "estimate"
			? trpc.estimates.document.queryOptions({ id: documentId })
			: kind === "invoice"
				? trpc.invoices.document.queryOptions({ id: documentId })
				: trpc.contracts.document.queryOptions({ id: documentId });

	const pdf = useQuery({
		...documentOptions,
		enabled: open,
		staleTime: 0,
	});

	const email = useQuery({
		...trpc.templates.preview.queryOptions({ purpose, ...refs }),
		enabled: open,
	});

	const base64 = pdf.data?.base64;
	useEffect(() => {
		if (!open || !base64) return;
		const url = pdfBlobUrl(base64);
		setPdfUrl(url);
		return () => {
			setPdfUrl(null);
			URL.revokeObjectURL(url);
		};
	}, [open, base64]);

	const missing = email.data?.missing ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[85vh] flex-col sm:max-w-(--container-page-wide)">
				<DialogHeader>
					<DialogTitle>Preview {entityLabel}</DialogTitle>
					<DialogDescription>
						Exactly what the client receives. Nothing is sent from here.
					</DialogDescription>
				</DialogHeader>
				<Tabs defaultValue="pdf" className="flex min-h-0 flex-1 flex-col">
					<TabsList>
						<TabsTrigger value="pdf">PDF</TabsTrigger>
						<TabsTrigger value="email">Email</TabsTrigger>
					</TabsList>
					<TabsContent value="pdf" className="min-h-0 flex-1">
						{pdf.isPending ? (
							<div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
								<Spinner data-icon="inline-start" />
								Building the PDF…
							</div>
						) : pdf.isError || !pdfUrl ? (
							<div className="flex h-full flex-col items-center justify-center gap-3">
								<p className="text-muted-foreground text-sm">
									The PDF could not be generated.
								</p>
								<Button variant="outline" onClick={() => void pdf.refetch()}>
									Retry
								</Button>
							</div>
						) : (
							<object
								data={pdfUrl}
								type="application/pdf"
								aria-label={`${entityLabel} PDF preview`}
								className="h-full w-full rounded-lg border"
							>
								<div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
									This browser cannot display PDFs inline. Use Download PDF
									instead.
								</div>
							</object>
						)}
					</TabsContent>
					<TabsContent
						value="email"
						className="flex min-h-0 flex-1 flex-col gap-2"
					>
						{missing.length > 0 ? (
							<Alert variant="warning">
								<Icon icon={Warning} />
								<AlertTitle>
									{missing.length === 1
										? "One merge field needs a value"
										: `${missing.length} merge fields need a value`}
								</AlertTitle>
								<AlertDescription>
									<ul className="list-disc pl-4">
										{missing.map((entry) => (
											<li key={entry.token}>{entry.label}</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						) : null}
						{email.isPending ? (
							<div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground text-sm">
								<Spinner data-icon="inline-start" />
								Rendering the email…
							</div>
						) : email.isError ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3">
								<p className="text-muted-foreground text-sm">
									The email could not be rendered.
								</p>
								<Button variant="outline" onClick={() => void email.refetch()}>
									Retry
								</Button>
							</div>
						) : (
							<>
								<p className="text-sm">
									<span className="text-muted-foreground">Subject: </span>
									{email.data?.subject}
								</p>
								<iframe
									title={`${entityLabel} email preview`}
									sandbox=""
									srcDoc={email.data?.html ?? ""}
									className="min-h-0 w-full flex-1 rounded-lg border bg-white"
								/>
							</>
						)}
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
