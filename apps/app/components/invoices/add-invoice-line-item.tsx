"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type ServiceRow = RouterOutputs["services"]["list"]["rows"][number];
type ServiceUnit = ServiceRow["unit"];

const UNIT_LABELS: Record<ServiceUnit, string> = {
	PER_SQUARE: "per square",
	PER_LINEAR_FT: "per linear ft",
	PER_EACH: "per each",
	FLAT: "flat",
};

const UNIT_OPTIONS = Object.entries(UNIT_LABELS) as [ServiceUnit, string][];

const MAX_QUANTITY = 9_999_999.99;

function parseQuantity(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return 1;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_QUANTITY) {
		return undefined;
	}
	return Math.round(parsed * 100) / 100;
}

function emptyCustom() {
	return { name: "", unit: "PER_EACH" as ServiceUnit, quantity: "1" };
}

export function AddInvoiceLineItem({
	invoiceId,
	currency,
}: {
	invoiceId: string;
	currency: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"service" | "custom">("service");
	const [custom, setCustom] = useState(emptyCustom());
	const nameId = useId();
	const quantityId = useId();

	const services = useQuery({
		...trpc.services.list.queryOptions({ active: true, pageSize: 100 }),
		enabled: open,
	});

	const add = useMutation(
		trpc.invoices.addLineItem.mutationOptions({
			onSuccess: () => {
				void cache.invoice(invoiceId, { settle: "record" });
				setOpen(false);
				setMode("service");
				setCustom(emptyCustom());
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const addService = (service: ServiceRow) => {
		add.mutate({
			invoiceId,
			name: service.name,
			unit: service.unit,
			quantity: 1,
			priceCents: service.unitPriceCents,
		});
	};

	const submitCustom = () => {
		const name = custom.name.trim();
		if (!name) {
			toast.error("A line item needs a name.");
			return;
		}
		const quantity = parseQuantity(custom.quantity);
		if (quantity === undefined) {
			toast.error("Quantity has to be zero or more, and not too large.");
			return;
		}
		add.mutate({ invoiceId, name, unit: custom.unit, quantity });
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					<Icon icon={Add} data-icon="inline-start" />
					Add item
				</Button>
			</PopoverTrigger>
			<PopoverContent size="fit" align="start" className="w-80">
				<div className="flex gap-1 border-b p-1">
					<Button
						variant={mode === "service" ? "secondary" : "ghost"}
						size="sm"
						className="flex-1"
						onClick={() => setMode("service")}
					>
						From price book
					</Button>
					<Button
						variant={mode === "custom" ? "secondary" : "ghost"}
						size="sm"
						className="flex-1"
						onClick={() => setMode("custom")}
					>
						Custom line
					</Button>
				</div>

				{mode === "service" ? (
					<Command>
						<CommandInput placeholder="Search services…" />
						<CommandList>
							<CommandEmpty>
								{services.isPending ? "Loading…" : "No services found."}
							</CommandEmpty>
							<CommandGroup>
								{(services.data?.rows ?? []).map((service) => (
									<CommandItem
										key={service.id}
										value={service.name}
										onSelect={() => addService(service)}
									>
										<span className="flex-1 truncate">{service.name}</span>
										<span className="text-muted-foreground tabular-nums">
											{formatMoney(service.unitPriceCents, currency)}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				) : (
					<div className="flex flex-col gap-3 p-3">
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								autoFocus
								value={custom.name}
								onChange={(event) =>
									setCustom((previous) => ({
										...previous,
										name: event.target.value,
									}))
								}
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Unit</FieldLabel>
								<Select
									value={custom.unit}
									onValueChange={(unit) =>
										setCustom((previous) => ({
											...previous,
											unit: unit as ServiceUnit,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{UNIT_OPTIONS.map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor={quantityId}>Quantity</FieldLabel>
								<Input
									id={quantityId}
									inputMode="decimal"
									value={custom.quantity}
									onChange={(event) =>
										setCustom((previous) => ({
											...previous,
											quantity: event.target.value,
										}))
									}
								/>
							</Field>
						</div>
						<Button
							className="mt-1 w-full"
							disabled={add.isPending}
							onClick={submitCustom}
						>
							Add line
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
