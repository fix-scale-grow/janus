"use client";

import {
	type MeasuredShape,
	PITCH_FACTORS,
	type PitchKey,
	quantityForUnit,
	unitCompatibleWithKind,
} from "@crm/drawings";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMemo } from "react";
import type { RouterOutputs } from "@/lib/trpc/types";

type ServiceRow = RouterOutputs["services"]["list"]["rows"][number];

export type ScopeShapeUpdate = {
	label?: string | null;
	pitch?: PitchKey | null;
	serviceId?: string | null;
};

export type ScopePanelProps = {
	shapes: MeasuredShape[];
	services: ServiceRow[];
	onUpdateShape: (scopeId: string, update: ScopeShapeUpdate) => void;
	onGenerate: () => void;
	generating: boolean;
};

function quantityLabel(shape: MeasuredShape): string | null {
	if (!shape.quantity) return null;
	if ("areaSqFt" in shape.quantity) {
		return `${shape.quantity.areaSqFt.toFixed(1)} sq ft · ${shape.quantity.squares.toFixed(1)} sq`;
	}
	if ("lengthFt" in shape.quantity) {
		return `${Math.round(shape.quantity.lengthFt)} ln ft`;
	}
	return `${shape.quantity.count} pin${shape.quantity.count === 1 ? "" : "s"}`;
}

function kindLabel(kind: MeasuredShape["kind"]): string {
	if (kind === "area") return "Area";
	if (kind === "line") return "Line";
	return "Pin";
}

function resolvedService(
	shape: MeasuredShape,
	servicesById: Map<string, ServiceRow>,
	servicesBySymbol: Map<string, ServiceRow>,
): { service: ServiceRow | null; auto: boolean } {
	if (shape.serviceId) {
		return { service: servicesById.get(shape.serviceId) ?? null, auto: false };
	}
	if (shape.symbol) {
		return { service: servicesBySymbol.get(shape.symbol) ?? null, auto: true };
	}
	return { service: null, auto: false };
}

function ScopeServiceField(props: {
	shape: MeasuredShape;
	services: ServiceRow[];
	servicesById: Map<string, ServiceRow>;
	servicesBySymbol: Map<string, ServiceRow>;
	onUpdateShape: (scopeId: string, update: ScopeShapeUpdate) => void;
}) {
	const { shape, servicesById, servicesBySymbol } = props;
	const { service, auto } = resolvedService(
		shape,
		servicesById,
		servicesBySymbol,
	);
	const compatible = props.services.filter(
		(candidate) =>
			unitCompatibleWithKind(candidate.unit, shape.kind) ||
			candidate.id === shape.serviceId,
	);
	const mismatched = service
		? !unitCompatibleWithKind(service.unit, shape.kind)
		: false;

	return (
		<div className="flex flex-col gap-1">
			{auto && service && (
				<div className="flex items-center gap-1.5 text-xs">
					<span>{service.name}</span>
					<Badge variant="secondary">auto</Badge>
				</div>
			)}
			<Select
				onValueChange={(value) =>
					props.onUpdateShape(shape.scopeId, { serviceId: value })
				}
				value={service && !auto ? service.id : undefined}
			>
				<SelectTrigger className="w-full">
					<SelectValue
						placeholder={auto && service ? "Override service" : "No service"}
					/>
				</SelectTrigger>
				<SelectContent>
					{compatible.map((candidate) => (
						<SelectItem key={candidate.id} value={candidate.id}>
							{candidate.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{!service && (
				<span className="text-muted-foreground text-xs">no service</span>
			)}
			{service && mismatched && (
				<span className="text-destructive text-xs">
					won't price — unit mismatch
				</span>
			)}
		</div>
	);
}

export function ScopePanel(props: ScopePanelProps) {
	const servicesById = useMemo(
		() => new Map(props.services.map((service) => [service.id, service])),
		[props.services],
	);
	const servicesBySymbol = useMemo(
		() =>
			new Map(
				props.services
					.filter((service) => service.symbolId)
					.map((service) => [service.symbolId as string, service]),
			),
		[props.services],
	);

	const canGenerate = useMemo(
		() =>
			props.shapes.some((shape) => {
				const { service } = resolvedService(
					shape,
					servicesById,
					servicesBySymbol,
				);
				return (
					service !== null &&
					unitCompatibleWithKind(service.unit, shape.kind) &&
					quantityForUnit(service.unit, shape.quantity) !== null
				);
			}),
		[props.shapes, servicesById, servicesBySymbol],
	);

	return (
		<div className="flex h-full w-72 shrink-0 flex-col gap-3 overflow-y-auto border-border border-l p-3">
			<h2 className="font-heading text-sm font-medium">Scope</h2>

			{props.shapes.length === 0 && (
				<p className="text-muted-foreground text-xs">
					Mark a shape to measure it.
				</p>
			)}

			{props.shapes.map((shape) => (
				<div
					className="flex flex-col gap-2 rounded-lg border border-border p-2"
					key={shape.scopeId}
				>
					<div className="flex items-center justify-between gap-2">
						<Badge variant="outline">{kindLabel(shape.kind)}</Badge>
						<span className="text-muted-foreground text-xs">
							{quantityLabel(shape) ?? "unmeasured — set scale"}
						</span>
					</div>

					<Input
						onChange={(event) =>
							props.onUpdateShape(shape.scopeId, {
								label: event.target.value || null,
							})
						}
						placeholder="Label"
						value={shape.label ?? ""}
					/>

					<ScopeServiceField
						onUpdateShape={props.onUpdateShape}
						servicesById={servicesById}
						servicesBySymbol={servicesBySymbol}
						services={props.services}
						shape={shape}
					/>

					{shape.kind === "area" && (
						<Select
							onValueChange={(value) =>
								props.onUpdateShape(shape.scopeId, {
									pitch: value as PitchKey,
								})
							}
							value={shape.pitch ?? undefined}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Pitch" />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(PITCH_FACTORS).map((pitch) => (
									<SelectItem key={pitch} value={pitch}>
										{pitch}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			))}

			<div className="mt-auto pt-1">
				{canGenerate ? (
					<Button
						className="w-full"
						disabled={props.generating}
						onClick={props.onGenerate}
					>
						Generate estimate
					</Button>
				) : (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="block w-full">
								<Button className="w-full" disabled>
									Generate estimate
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>Tag shapes with services first.</TooltipContent>
					</Tooltip>
				)}
			</div>
		</div>
	);
}
