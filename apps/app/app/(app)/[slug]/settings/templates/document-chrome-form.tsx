"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function DocumentChromeForm() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const headerId = useId();
	const footerId = useId();

	const settings = useQuery(trpc.settings.documentChromeText.queryOptions());

	const [headerText, setHeaderText] = useState("");
	const [footerText, setFooterText] = useState("");

	useEffect(() => {
		if (!settings.data) return;
		setHeaderText(settings.data.headerText ?? "");
		setFooterText(settings.data.footerText ?? "");
	}, [settings.data]);

	const save = useMutation(
		trpc.settings.setDocumentChromeText.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.settings.documentChromeText.queryKey(),
				});
				toast.success("Document text saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const commit = () => {
		const nextHeader = headerText.trim() || null;
		const nextFooter = footerText.trim() || null;
		if (
			nextHeader === (settings.data?.headerText ?? null) &&
			nextFooter === (settings.data?.footerText ?? null)
		) {
			return;
		}
		save.mutate({ headerText: nextHeader, footerText: nextFooter });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Document header and footer</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					Printed on every contract and proposal PDF, under your business name
					in the header and in the page footer. License number, phone, address.
				</p>
				<Field>
					<FieldLabel htmlFor={headerId}>Header line</FieldLabel>
					<Input
						id={headerId}
						value={headerText}
						onChange={(event) => setHeaderText(event.target.value)}
						onBlur={commit}
						maxLength={200}
						placeholder="Licensed and insured · AL Lic #12345"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={footerId}>Footer line</FieldLabel>
					<Input
						id={footerId}
						value={footerText}
						onChange={(event) => setFooterText(event.target.value)}
						onBlur={commit}
						maxLength={200}
						placeholder="(555) 123-4567 · office@yourcompany.com"
					/>
				</Field>
			</CardContent>
		</Card>
	);
}
