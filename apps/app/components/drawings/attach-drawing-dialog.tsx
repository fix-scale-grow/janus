"use client";

import { Button } from "@crm/ui/components/button";
import { Combobox, type ComboboxOption } from "@crm/ui/components/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Spinner } from "@crm/ui/components/spinner";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const DEAL_PICKER_BASE = {
	sort: "",
	dir: "asc",
	page: 1,
	pageSize: 20,
	status: "all",
	owner: "all",
	stage: "all",
	closing: "all",
} as const;

function DealPicker({
	value,
	onValueChange,
	selected,
}: {
	value: string;
	onValueChange: (value: string) => void;
	selected?: ComboboxOption;
}) {
	const trpc = useTRPC();
	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);

	const deals = useQuery({
		...trpc.deals.list.queryOptions({ ...DEAL_PICKER_BASE, q: query }),
		placeholderData: (previous) => previous,
	});

	const options: ComboboxOption[] = (deals.data?.rows ?? []).map((deal) => ({
		value: deal.id,
		label: deal.name,
	}));

	const stale = deals.isFetching || text.trim() !== query.trim();

	return (
		<Combobox
			value={value}
			onValueChange={onValueChange}
			selectedOption={selected}
			options={options}
			placeholder="Choose a job"
			searchPlaceholder="Search jobs…"
			empty={deals.isFetching ? "Searching…" : "No job matches."}
			search={text}
			onSearchChange={setText}
			stale={stale}
			className="w-full"
		/>
	);
}

export function AttachDrawingDialog({
	drawingId,
	dealId,
	dealName,
	open,
	onOpenChange,
}: {
	drawingId: string;
	dealId: string | null;
	dealName: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [selected, setSelected] = useState(dealId ?? "");

	const attach = useMutation(
		trpc.drawings.attach.mutationOptions({
			onSuccess: () => {
				void cache.drawing(drawingId);
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) setSelected(dealId ?? "");
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Attach to a job</DialogTitle>
					<DialogDescription>
						Put this drawing on a deal so the crew finds it from the job.
					</DialogDescription>
				</DialogHeader>

				<DealPicker
					value={selected}
					onValueChange={setSelected}
					selected={
						dealId && dealName ? { value: dealId, label: dealName } : undefined
					}
				/>

				<DialogFooter>
					{dealId ? (
						<Button
							variant="outline"
							disabled={attach.isPending}
							onClick={() => attach.mutate({ id: drawingId, dealId: null })}
						>
							Detach
						</Button>
					) : null}
					<Button
						disabled={attach.isPending || !selected || selected === dealId}
						onClick={() => attach.mutate({ id: drawingId, dealId: selected })}
					>
						{attach.isPending ? <Spinner /> : null}
						Attach
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
