"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { currencySymbol, formatMoney } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { InvoiceLineItemRow } from "./invoice-detail";

const UNIT_LABELS: Record<InvoiceLineItemRow["unit"], string> = {
	PER_SQUARE: "per square",
	PER_LINEAR_FT: "per linear ft",
	PER_EACH: "per each",
	FLAT: "flat",
};

function centsToDollars(cents: number): string {
	return (cents / 100).toFixed(2);
}

function parseCents(value: string): number | undefined {
	const trimmed = value.trim();
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return Math.round(parsed * 100);
}

const MAX_QUANTITY = 9_999_999.99;

function parseQuantity(value: string): number | undefined {
	const trimmed = value.trim();
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_QUANTITY) {
		return undefined;
	}
	return Math.round(parsed * 100) / 100;
}

export function InvoiceLineRow({
	invoiceId,
	item,
	currency,
}: {
	invoiceId: string;
	item: InvoiceLineItemRow;
	currency: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const itemQuantity = Number(item.quantity);
	const symbol = currencySymbol(currency);

	const [name, setName] = useState(item.name);
	const [quantity, setQuantity] = useState(itemQuantity.toFixed(2));
	const [price, setPrice] = useState(centsToDollars(item.priceCents));

	useEffect(() => setName(item.name), [item.name]);
	useEffect(() => setQuantity(itemQuantity.toFixed(2)), [itemQuantity]);
	useEffect(() => setPrice(centsToDollars(item.priceCents)), [item.priceCents]);

	const update = useMutation(
		trpc.invoices.updateLineItem.mutationOptions({
			onSuccess: () => void cache.invoice(invoiceId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.invoices.removeLineItem.mutationOptions({
			onSuccess: () => void cache.invoice(invoiceId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitName = () => {
		const next = name.trim();
		if (!next) {
			setName(item.name);
			return;
		}
		if (next === item.name) return;
		update.mutate({ id: item.id, data: { name: next } });
	};

	const commitQuantity = () => {
		const parsed = parseQuantity(quantity);
		if (parsed === undefined) {
			toast.error("Quantity has to be zero or more, and not too large.");
			setQuantity(itemQuantity.toFixed(2));
			return;
		}
		setQuantity(parsed.toFixed(2));
		if (parsed === itemQuantity) return;
		update.mutate({ id: item.id, data: { quantity: parsed } });
	};

	const commitPrice = () => {
		const parsed = parseCents(price);
		if (parsed === undefined) {
			toast.error("Price has to be a number, zero or more.");
			setPrice(centsToDollars(item.priceCents));
			return;
		}
		setPrice(centsToDollars(parsed));
		if (parsed === item.priceCents) return;
		update.mutate({ id: item.id, data: { priceCents: parsed } });
	};

	const lineTotalCents = Math.round(itemQuantity * item.priceCents);

	return (
		<SimpleTableRow>
			<TableCell className="px-3 py-2">
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					onBlur={commitName}
				/>
			</TableCell>
			<TableCell className="px-3 py-2">
				<Input
					inputMode="decimal"
					value={quantity}
					onChange={(event) => setQuantity(event.target.value)}
					onBlur={commitQuantity}
					className="text-right tabular-nums"
				/>
			</TableCell>
			<TableCell className="px-3 py-2 text-muted-foreground">
				{UNIT_LABELS[item.unit]}
			</TableCell>
			<TableCell className="px-3 py-2">
				<InputGroup>
					<InputGroupAddon>
						<InputGroupText>{symbol}</InputGroupText>
					</InputGroupAddon>
					<InputGroupInput
						inputMode="decimal"
						value={price}
						onChange={(event) => setPrice(event.target.value)}
						onBlur={commitPrice}
						className="text-right tabular-nums"
					/>
				</InputGroup>
			</TableCell>
			<TableCell className="px-3 py-2 text-right tabular-nums">
				{formatMoney(lineTotalCents, currency)}
			</TableCell>
			<TableCell className="px-3 py-2">
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={() => remove.mutate({ id: item.id })}
				>
					<Icon icon={TrashCan} />
					<span className="sr-only">Remove {item.name}</span>
				</Button>
			</TableCell>
		</SimpleTableRow>
	);
}
