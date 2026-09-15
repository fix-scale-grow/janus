"use client";

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
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { GroupBadge, GroupEditor, SCOPE_LABEL } from "./group-editor";

export function GroupsPanel() {
	const trpc = useTRPC();
	const groups = useQuery(trpc.accessGroups.list.queryOptions());
	const rows = groups.data ?? [];

	const [selectedId, setSelectedId] = useState<string | null>(
		rows[0]?.id ?? null,
	);
	const [creatingNew, setCreatingNew] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [pendingSwitch, setPendingSwitch] = useState<{
		id: string | null;
		asNew: boolean;
	} | null>(null);

	if (!groups.data) return null;

	const selected = creatingNew
		? null
		: (rows.find((row) => row.id === selectedId) ?? null);

	const requestSwitch = (id: string | null, asNew: boolean) => {
		if (dirty) {
			setPendingSwitch({ id, asNew });
			return;
		}
		setCreatingNew(asNew);
		setSelectedId(id);
	};

	const confirmSwitch = () => {
		if (!pendingSwitch) return;
		setCreatingNew(pendingSwitch.asNew);
		setSelectedId(pendingSwitch.id);
		setPendingSwitch(null);
	};

	return (
		<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[230px_1fr]">
			<div className="flex flex-col gap-2">
				{rows.map((row) => (
					<button
						aria-pressed={!creatingNew && row.id === selectedId}
						className="flex flex-col gap-1 rounded-md border p-2 text-left aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
						key={row.id}
						onClick={() => requestSwitch(row.id, false)}
						type="button"
					>
						<span className="flex items-center justify-between gap-2 font-medium text-sm">
							{row.name}
							<GroupBadge surface={row.surface} />
						</span>
						<span className="text-muted-foreground text-xs">
							{row.memberCount} {row.memberCount === 1 ? "person" : "people"} ·{" "}
							{SCOPE_LABEL[row.scope].split(" (")[0]}
						</span>
					</button>
				))}

				<Button onClick={() => requestSwitch(null, true)} variant="outline">
					New group
				</Button>
			</div>

			{creatingNew || selected ? (
				<GroupEditor
					group={selected}
					key={creatingNew ? "new" : selected?.id}
					onCancelNew={() => {
						setCreatingNew(false);
						setSelectedId(rows[0]?.id ?? null);
					}}
					onCreated={(id) => {
						setCreatingNew(false);
						setSelectedId(id);
					}}
					onDeleted={() => {
						const next = rows.find((row) => row.id !== selectedId);
						setSelectedId(next?.id ?? null);
					}}
					onDirtyChange={setDirty}
				/>
			) : null}

			<AlertDialog
				onOpenChange={(open) => {
					if (!open) setPendingSwitch(null);
				}}
				open={pendingSwitch !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Switching groups loses what you changed here.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmSwitch}>
							Discard
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
