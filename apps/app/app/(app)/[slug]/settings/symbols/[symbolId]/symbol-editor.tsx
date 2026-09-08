"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import {
	DRAWINGS,
	type ExcalidrawElement,
	excalidrawElement,
} from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
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
import { Switch } from "@crm/ui/components/switch";
import type {
	ExcalidrawImperativeAPI,
	ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { JanusExcalidraw } from "@/components/drawings/janus-excalidraw";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const NONE = "none";

const NEW_CATEGORY = "__new__";

const TRADE_MAX_LENGTH = 60;

const symbolDetailRow = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	trade: z.string().min(1),
	elements: excalidrawElement.array(),
	widthFt: z.coerce.number().positive().nullable(),
	heightFt: z.coerce.number().positive().nullable(),
	serviceId: z.string().min(1).nullable(),
	active: z.boolean(),
});

function parseSymbolDetail(
	value: unknown,
): z.infer<typeof symbolDetailRow> | null {
	const parsed = symbolDetailRow.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseOptionalPositiveFt(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

type FormValues = {
	name: string;
	trade: string;
	widthFt: string;
	heightFt: string;
	serviceId: string;
	active: boolean;
};

function emptyForm(): FormValues {
	return {
		name: "",
		trade: "roofing",
		widthFt: "",
		heightFt: "",
		serviceId: NONE,
		active: true,
	};
}

function formFromRow(row: z.infer<typeof symbolDetailRow>): FormValues {
	return {
		name: row.name,
		trade: row.trade,
		widthFt: row.widthFt ? String(row.widthFt) : "",
		heightFt: row.heightFt ? String(row.heightFt) : "",
		serviceId: row.serviceId ?? NONE,
		active: row.active,
	};
}

export function SymbolEditor({ symbolId }: { symbolId: string }) {
	const isNew = symbolId === "new";
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const services = useQuery(
		trpc.services.list.queryOptions({ active: true, pageSize: 100 }),
	);
	const symbolQuery = useQuery({
		...trpc.symbols.byId.queryOptions({ id: symbolId }),
		enabled: !isNew,
	});
	const symbolsList = useQuery(
		trpc.symbols.list.queryOptions({ pageSize: 100 }),
	);

	const symbolData: unknown = symbolQuery.data;
	const symbol = isNew || !symbolData ? null : parseSymbolDetail(symbolData);

	const [values, setValues] = useState<FormValues>(() =>
		symbol ? formFromRow(symbol) : emptyForm(),
	);
	const [addingCategory, setAddingCategory] = useState(false);

	const categories = useMemo(() => {
		const byKey = new Map<string, string>();
		for (const row of symbolsList.data?.rows ?? []) {
			const trade = typeof row.trade === "string" ? row.trade.trim() : "";
			if (!trade) continue;
			const key = trade.toLowerCase();
			if (!byKey.has(key)) byKey.set(key, trade);
		}
		const trade = values.trade.trim();
		if (trade) byKey.set(trade.toLowerCase(), trade);
		return Array.from(byKey.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([key, label]) => ({ key, label }));
	}, [symbolsList.data, values.trade]);

	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const excalidrawApiRef = useCallback((api: ExcalidrawImperativeAPI) => {
		apiRef.current = api;
	}, []);

	const nameId = useId();
	const tradeId = useId();
	const widthId = useId();
	const heightId = useId();
	const serviceFieldId = useId();
	const activeId = useId();

	const backHref = workspaceUrl("/settings/symbols");

	const onSaved = async (id: string) => {
		await cache.symbol(id);
		toast.success("Symbol saved.");
		router.push(backHref);
	};

	const create = useMutation({
		...trpc.symbols.create.mutationOptions(),
		onSuccess: (result) => onSaved(result.id),
		onError: (error) => toast.error(error.message),
	});

	const update = useMutation({
		...trpc.symbols.update.mutationOptions(),
		onSuccess: (result) => onSaved(result.id),
		onError: (error) => toast.error(error.message),
	});

	const busy = create.isPending || update.isPending;

	const handleSave = () => {
		const name = values.name.trim();
		if (!name) {
			toast.error("A symbol needs a name.");
			return;
		}

		const trade = values.trade.trim() || "roofing";

		const widthFt = parseOptionalPositiveFt(values.widthFt);
		if (widthFt === undefined) {
			toast.error("Width has to be a number greater than zero.");
			return;
		}

		const heightFt = parseOptionalPositiveFt(values.heightFt);
		if (heightFt === undefined) {
			toast.error("Height has to be a number greater than zero.");
			return;
		}

		const api = apiRef.current;
		if (!api) return;

		const drawn = api
			.getSceneElements()
			.filter((element) => !element.isDeleted);
		if (drawn.length === 0) {
			toast.error("Draw something before saving.");
			return;
		}
		if (drawn.length > DRAWINGS.symbol.maxElements) {
			toast.error(`Use ${DRAWINGS.symbol.maxElements} shapes or fewer.`);
			return;
		}

		const minX = Math.min(...drawn.map((element) => element.x));
		const minY = Math.min(...drawn.map((element) => element.y));
		const normalized = drawn.map((element) => {
			const clone = structuredClone(element) as Record<string, unknown>;
			delete clone.customData;
			clone.boundElements = null;
			clone.containerId = null;
			clone.x = (clone.x as number) - minX;
			clone.y = (clone.y as number) - minY;
			return clone;
		});

		let elements: ExcalidrawElement[];
		try {
			elements = excalidrawElement.array().parse(normalized);
		} catch {
			toast.error("That drawing can't be saved as a symbol.");
			return;
		}

		const serviceId = values.serviceId === NONE ? null : values.serviceId;

		if (isNew) {
			create.mutate({
				name,
				trade,
				elements,
				widthFt,
				heightFt,
				serviceId,
				active: values.active,
			});
		} else {
			update.mutate({
				id: symbolId,
				data: {
					name,
					trade,
					elements,
					widthFt,
					heightFt,
					serviceId,
					active: values.active,
				},
			});
		}
	};

	const initialElements = symbol?.elements ?? [];

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>
						{isNew ? "New symbol" : "Edit symbol"}
					</PageShellTitle>
					<PageShellDescription>
						Draw the shape a drawing's symbol palette places.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Button asChild variant="outline">
						<Link href={backHref}>
							<Icon data-icon="inline-start" icon={ArrowLeft} />
							Cancel
						</Link>
					</Button>
					<Button disabled={busy} onClick={handleSave}>
						{busy ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="grid gap-4 md:grid-cols-[280px_1fr]">
					<div className="flex flex-col gap-4">
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								autoFocus
								id={nameId}
								onChange={(event) =>
									setValues((prev) => ({ ...prev, name: event.target.value }))
								}
								value={values.name}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={tradeId}>Category</FieldLabel>
							{addingCategory ? (
								<div className="flex flex-col gap-1.5">
									<Input
										autoFocus
										id={tradeId}
										maxLength={TRADE_MAX_LENGTH}
										onChange={(event) =>
											setValues((prev) => ({
												...prev,
												trade: event.target.value,
											}))
										}
										placeholder="New category"
										value={values.trade}
									/>
									<Button
										className="self-start"
										onClick={() => {
											setAddingCategory(false);
											setValues((prev) => ({
												...prev,
												trade: categories[0]?.label ?? "roofing",
											}));
										}}
										size="sm"
										variant="link"
									>
										Back to the category list
									</Button>
								</div>
							) : (
								<Select
									onValueChange={(next) => {
										if (next === NEW_CATEGORY) {
											setAddingCategory(true);
											setValues((prev) => ({ ...prev, trade: "" }));
											return;
										}
										setValues((prev) => ({ ...prev, trade: next }));
									}}
									value={values.trade}
								>
									<SelectTrigger className="w-full" id={tradeId}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{categories.map((category) => (
											<SelectItem key={category.key} value={category.label}>
												{category.label}
											</SelectItem>
										))}
										<SelectItem value={NEW_CATEGORY}>New category…</SelectItem>
									</SelectContent>
								</Select>
							)}
						</Field>

						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor={widthId}>Width (ft)</FieldLabel>
								<Input
									id={widthId}
									inputMode="decimal"
									onChange={(event) =>
										setValues((prev) => ({
											...prev,
											widthFt: event.target.value,
										}))
									}
									placeholder="Optional"
									value={values.widthFt}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor={heightId}>Height (ft)</FieldLabel>
								<Input
									id={heightId}
									inputMode="decimal"
									onChange={(event) =>
										setValues((prev) => ({
											...prev,
											heightFt: event.target.value,
										}))
									}
									placeholder="Optional"
									value={values.heightFt}
								/>
							</Field>
						</div>
						<FieldDescription>
							Set one so this symbol drops at true scale.
						</FieldDescription>

						<Field>
							<FieldLabel htmlFor={serviceFieldId}>Linked service</FieldLabel>
							<Select
								onValueChange={(serviceId) =>
									setValues((prev) => ({ ...prev, serviceId }))
								}
								value={values.serviceId}
							>
								<SelectTrigger className="w-full" id={serviceFieldId}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>None</SelectItem>
									{(services.data?.rows ?? []).map((service) => (
										<SelectItem key={service.id} value={service.id}>
											{service.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field orientation="horizontal">
							<FieldLabel htmlFor={activeId}>Active</FieldLabel>
							<Switch
								checked={values.active}
								id={activeId}
								onCheckedChange={(active) =>
									setValues((prev) => ({ ...prev, active }))
								}
							/>
						</Field>
					</div>

					<div className="janus-symbol-canvas h-[600px] overflow-hidden rounded-lg border border-border">
						<style>{`
							.janus-symbol-canvas .default-sidebar-trigger { display: none; }
							.janus-symbol-canvas .App-toolbar__extra-tools-trigger { display: none; }
						`}</style>
						{isNew || symbol ? (
							<JanusExcalidraw
								excalidrawAPI={excalidrawApiRef}
								initialData={
									{
										elements: initialElements,
									} as unknown as ExcalidrawProps["initialData"]
								}
							/>
						) : (
							<div className="flex h-full items-center justify-center">
								<Spinner />
							</div>
						)}
					</div>
				</div>
			</PageShellContent>
		</PageShell>
	);
}
