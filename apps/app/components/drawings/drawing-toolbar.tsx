"use client";

import AreaCustom from "@carbon/icons-react/es/AreaCustom";
import ArrowUpRight from "@carbon/icons-react/es/ArrowUpRight";
import Cursor_1 from "@carbon/icons-react/es/Cursor_1";
import DataVis_1 from "@carbon/icons-react/es/DataVis_1";
import HistoryIcon from "@carbon/icons-react/es/History";
import ImageIcon from "@carbon/icons-react/es/Image";
import Location from "@carbon/icons-react/es/Location";
import Move from "@carbon/icons-react/es/Move";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import Pen from "@carbon/icons-react/es/Pen";
import RadioButton from "@carbon/icons-react/es/RadioButton";
import Ruler from "@carbon/icons-react/es/Ruler";
import Shapes from "@carbon/icons-react/es/Shapes";
import SquareOutline from "@carbon/icons-react/es/SquareOutline";
import StringText from "@carbon/icons-react/es/StringText";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { Separator } from "@crm/ui/components/separator";
import { Toggle } from "@crm/ui/components/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useState } from "react";
import { SHAPE_MODES, type ShapeMode, type ToolMode } from "./toolbar-modes";

export type OverflowAction =
	| "background"
	| "history"
	| "mark-area"
	| "mark-line";

export type DrawingToolbarProps = {
	mode: ToolMode;
	onModeChange: (mode: ToolMode) => void;
	onOverflowAction: (action: OverflowAction) => void;
	scaleLabel: string | null;
	symbolPalette: React.ReactNode;
};

const SHAPE_ICONS: Record<ShapeMode, CarbonIcon> = {
	rectangle: SquareOutline,
	ellipse: RadioButton,
	arrow: ArrowUpRight,
	text: StringText,
};

const SHAPE_LABELS: Record<ShapeMode, string> = {
	rectangle: "Rectangle",
	ellipse: "Ellipse",
	arrow: "Arrow",
	text: "Text",
};

function ToolButton(props: {
	active: boolean;
	icon: CarbonIcon;
	label: string;
	onSelect: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Toggle
					aria-label={props.label}
					onPressedChange={props.onSelect}
					pressed={props.active}
				>
					<Icon icon={props.icon} />
				</Toggle>
			</TooltipTrigger>
			<TooltipContent side="right">{props.label}</TooltipContent>
		</Tooltip>
	);
}

function ShapesButton(props: {
	mode: ToolMode;
	onModeChange: (mode: ToolMode) => void;
}) {
	const [open, setOpen] = useState(false);
	const activeShape = SHAPE_MODES.find((shape) => shape === props.mode);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Toggle aria-label="Shapes" pressed={activeShape !== undefined}>
							<Icon icon={activeShape ? SHAPE_ICONS[activeShape] : Shapes} />
						</Toggle>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="right">Shapes</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="start"
				className="flex w-auto gap-0.5 p-1"
				side="right"
			>
				{SHAPE_MODES.map((shape) => (
					<Tooltip key={shape}>
						<TooltipTrigger asChild>
							<Toggle
								aria-label={SHAPE_LABELS[shape]}
								onPressedChange={() => {
									setOpen(false);
									props.onModeChange(shape);
								}}
								pressed={props.mode === shape}
							>
								<Icon icon={SHAPE_ICONS[shape]} />
							</Toggle>
						</TooltipTrigger>
						<TooltipContent side="bottom">{SHAPE_LABELS[shape]}</TooltipContent>
					</Tooltip>
				))}
			</PopoverContent>
		</Popover>
	);
}

export function DrawingToolbar(props: DrawingToolbarProps) {
	return (
		<div className="-translate-y-1/2 absolute top-1/2 left-3 z-10">
			<div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background p-1 shadow-sm">
				<ToolButton
					active={props.mode === "select"}
					icon={Cursor_1}
					label="Select"
					onSelect={() => props.onModeChange("select")}
				/>
				<ToolButton
					active={props.mode === "hand"}
					icon={Move}
					label="Pan"
					onSelect={() => props.onModeChange("hand")}
				/>
				<ToolButton
					active={props.mode === "freedraw"}
					icon={Pen}
					label="Draw"
					onSelect={() => props.onModeChange("freedraw")}
				/>
				<ShapesButton mode={props.mode} onModeChange={props.onModeChange} />

				<Separator />

				<ToolButton
					active={props.mode === "area"}
					icon={AreaCustom}
					label="Draw area"
					onSelect={() => props.onModeChange("area")}
				/>
				<ToolButton
					active={props.mode === "line"}
					icon={DataVis_1}
					label="Draw line"
					onSelect={() => props.onModeChange("line")}
				/>
				<ToolButton
					active={props.mode === "pin"}
					icon={Location}
					label="Pin"
					onSelect={() => props.onModeChange("pin")}
				/>
				{props.symbolPalette}

				<Separator />

				<Tooltip>
					<TooltipTrigger asChild>
						<Toggle
							aria-label="Set scale"
							onPressedChange={() => props.onModeChange("scale")}
							pressed={props.mode === "scale"}
						>
							<span className="relative flex">
								<Icon icon={Ruler} />
								{props.scaleLabel && (
									<span className="-top-0.5 -right-0.5 absolute size-1.5 rounded-full bg-primary" />
								)}
							</span>
						</Toggle>
					</TooltipTrigger>
					<TooltipContent side="right">
						{props.scaleLabel ? `Scale set · ${props.scaleLabel}` : "Set scale"}
					</TooltipContent>
				</Tooltip>

				<DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Toggle aria-label="More tools" pressed={false}>
									<Icon icon={OverflowMenuHorizontal} />
								</Toggle>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="right">More</TooltipContent>
					</Tooltip>
					<DropdownMenuContent align="start" side="right">
						<DropdownMenuItem
							onSelect={() => props.onOverflowAction("background")}
						>
							<Icon icon={ImageIcon} />
							Set background photo
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => props.onOverflowAction("history")}
						>
							<Icon icon={HistoryIcon} />
							Version history
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Selected shapes</DropdownMenuLabel>
						<DropdownMenuItem
							onSelect={() => props.onOverflowAction("mark-area")}
						>
							<Icon icon={AreaCustom} />
							Mark selection as area
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => props.onOverflowAction("mark-line")}
						>
							<Icon icon={DataVis_1} />
							Mark selection as line
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
