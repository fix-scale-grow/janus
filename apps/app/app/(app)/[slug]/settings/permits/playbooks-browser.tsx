"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
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
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
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
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	BACK,
	JURISDICTION_KIND_LABEL_TEXT,
	JURISDICTION_NAME_LABEL,
	JURISDICTION_STATE_LABEL,
	NEW_JURISDICTION,
	PLAYBOOKS_DESCRIPTION,
	PLAYBOOKS_EMPTY,
	PLAYBOOKS_TITLE,
	playbookCountNote,
	RESOLVE_JURISDICTION,
	SELECT_TYPE_LABEL_LABEL,
} from "./permits-copy";
import { PlaybookEditor } from "./playbook-editor";

type Jurisdiction = RouterOutputs["permits"]["jurisdictions"][number];

function permitsErrorMessage(error: { message: string }): string {
	return error.message;
}

function NewJurisdictionDialog({
	onCreated,
}: {
	onCreated: (jurisdictionId: string) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<JurisdictionKind>("CITY");
	const [state, setState] = useState("");

	const nameId = useId();
	const kindId = useId();
	const stateId = useId();

	const resolve = useMutation(
		trpc.permits.resolveJurisdiction.mutationOptions({
			onSuccess: (jurisdiction) => {
				void cache.jurisdiction();
				setOpen(false);
				setName("");
				setKind("CITY");
				setState("");
				onCreated(jurisdiction.id);
			},
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);

	const ready = name.trim() !== "" && state.trim().length === 2;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<Icon icon={Add} data-icon="inline-start" />
					{NEW_JURISDICTION}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{NEW_JURISDICTION}</DialogTitle>
					<DialogDescription>
						Janus builds a playbook for this jurisdiction once you pick a permit
						type.
					</DialogDescription>
				</DialogHeader>

				<form
					id="new-jurisdiction"
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!ready) return;
						resolve.mutate({
							name: name.trim(),
							kind,
							state: state.trim().toUpperCase(),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>
								{JURISDICTION_NAME_LABEL}
							</FieldLabel>
							<Input
								id={nameId}
								autoFocus
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>

						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor={kindId}>
									{JURISDICTION_KIND_LABEL_TEXT}
								</FieldLabel>
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
								<FieldLabel htmlFor={stateId}>
									{JURISDICTION_STATE_LABEL}
								</FieldLabel>
								<Input
									id={stateId}
									value={state}
									maxLength={2}
									onChange={(event) =>
										setState(event.target.value.toUpperCase())
									}
								/>
							</Field>
						</div>
					</FieldGroup>
				</form>

				<DialogFooter>
					<Button
						type="submit"
						form="new-jurisdiction"
						disabled={!ready || resolve.isPending}
					>
						{resolve.isPending ? <Spinner data-icon="inline-start" /> : null}
						{RESOLVE_JURISDICTION}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function JurisdictionList({
	jurisdictions,
	onSelect,
}: {
	jurisdictions: Jurisdiction[];
	onSelect: (id: string) => void;
}) {
	if (jurisdictions.length === 0) {
		return (
			<p className="p-4 text-muted-foreground text-sm">{PLAYBOOKS_EMPTY}</p>
		);
	}

	return (
		<div className="border-t">
			{jurisdictions.map((jurisdiction) => (
				<button
					key={jurisdiction.id}
					type="button"
					className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted"
					onClick={() => onSelect(jurisdiction.id)}
				>
					<span>
						{jurisdiction.name}, {jurisdiction.state}
					</span>
					<div className="flex items-center gap-2">
						<Badge variant="outline">
							{JURISDICTION_KIND_LABEL[jurisdiction.kind as JurisdictionKind]}
						</Badge>
						<span className="text-muted-foreground text-xs">
							{playbookCountNote(jurisdiction.playbookCount)}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}

function JurisdictionDetail({
	jurisdiction,
	onBack,
}: {
	jurisdiction: Jurisdiction;
	onBack: () => void;
}) {
	const [permitType, setPermitType] = useState<PermitType>("BUILDING");
	const [typeLabel, setTypeLabel] = useState("");
	const typeLabelId = useId();

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center gap-2">
				<Button type="button" variant="ghost" size="icon-sm" onClick={onBack}>
					<Icon icon={ArrowLeft} />
					<span className="sr-only">{BACK}</span>
				</Button>
				<span className="font-medium text-sm">
					{jurisdiction.name}, {jurisdiction.state}
				</span>
			</div>

			<Tabs
				value={permitType}
				onValueChange={(next) => setPermitType(next as PermitType)}
			>
				<TabsList>
					{PERMIT_TYPES.map((type) => (
						<TabsTrigger key={type} value={type}>
							{PERMIT_TYPE_LABEL[type]}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{permitType === "OTHER" ? (
				<Field>
					<FieldLabel htmlFor={typeLabelId}>
						{SELECT_TYPE_LABEL_LABEL}
					</FieldLabel>
					<Input
						id={typeLabelId}
						value={typeLabel}
						onChange={(event) => setTypeLabel(event.target.value)}
					/>
				</Field>
			) : null}

			{permitType !== "OTHER" || typeLabel.trim() !== "" ? (
				<PlaybookEditor
					key={`${jurisdiction.id}:${permitType}:${typeLabel.trim()}`}
					jurisdictionId={jurisdiction.id}
					permitType={permitType}
					typeLabel={permitType === "OTHER" ? typeLabel.trim() : undefined}
				/>
			) : null}
		</div>
	);
}

export function PlaybooksBrowser() {
	const trpc = useTRPC();
	const jurisdictions = useQuery(trpc.permits.jurisdictions.queryOptions());
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const selected = jurisdictions.data?.find(
		(jurisdiction) => jurisdiction.id === selectedId,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{PLAYBOOKS_TITLE}</CardTitle>
				<CardDescription>{PLAYBOOKS_DESCRIPTION}</CardDescription>
				<CardAction>
					<NewJurisdictionDialog onCreated={setSelectedId} />
				</CardAction>
			</CardHeader>

			{selected ? (
				<JurisdictionDetail
					jurisdiction={selected}
					onBack={() => setSelectedId(null)}
				/>
			) : (
				<JurisdictionList
					jurisdictions={jurisdictions.data ?? []}
					onSelect={setSelectedId}
				/>
			)}
		</Card>
	);
}
