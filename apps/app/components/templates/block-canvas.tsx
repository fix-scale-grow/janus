"use client";

import AddIcon from "@carbon/icons-react/es/Add";
import ArrowsVertical from "@carbon/icons-react/es/ArrowsVertical";
import ButtonCentered from "@carbon/icons-react/es/ButtonCentered";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronUp from "@carbon/icons-react/es/ChevronUp";
import Close from "@carbon/icons-react/es/Close";
import ColorPalette from "@carbon/icons-react/es/ColorPalette";
import Image from "@carbon/icons-react/es/Image";
import LineThin from "@carbon/icons-react/es/LineThin";
import PageBreak from "@carbon/icons-react/es/PageBreak";
import Pen from "@carbon/icons-react/es/Pen";
import TextAlignCenterIcon from "@carbon/icons-react/es/TextAlignCenter";
import TextAlignLeftIcon from "@carbon/icons-react/es/TextAlignLeft";
import TextAlignRightIcon from "@carbon/icons-react/es/TextAlignRight";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Separator } from "@crm/ui/components/separator";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type {
	KeyboardEvent,
	ClipboardEvent as ReactClipboardEvent,
	Ref,
} from "react";
import { useImperativeHandle, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import {
	fieldChipBeside,
	insertFieldChip,
	insertPlainText,
	type MergeFieldLabels,
	rangeWithin,
	serializeBlockHtml,
	serializeBlockText,
	toEditorHtml,
	toEditorText,
} from "./block-serialize";
import {
	BLOCK_KIND_LABELS,
	type BlockAlign,
	type BlockSize,
	createTemplateBlock,
	isEditableBlock,
	TEMPLATE_BLOCKS,
	type TemplateBlock,
	type TemplateBlockKind,
} from "./merge-fields";

export type EditorBlock = { id: string; block: TemplateBlock };

export type BlockCanvasHandle = { insertField: (token: string) => boolean };

type EditableKind = "heading" | "text";

const ROW =
	"group flex min-w-0 flex-1 flex-col gap-2 rounded-md border bg-background px-3 py-2 data-[selected=true]:border-primary";

const ACTION =
	"opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-data-[selected=true]:opacity-100";

const EDITABLE = "min-h-5 w-full whitespace-pre-wrap break-words outline-none";

export function BlockCanvas({
	blocks,
	onChange,
	labels,
	ref,
}: {
	blocks: EditorBlock[];
	onChange: (next: EditorBlock[]) => void;
	labels: MergeFieldLabels;
	ref?: Ref<BlockCanvasHandle>;
}) {
	const nodes = useRef(new Map<string, HTMLElement>());
	const lastRange = useRef<{ id: string; range: Range } | null>(null);
	const [selected, setSelected] = useState<string | null>(null);

	const replaceBlock = (id: string, block: TemplateBlock) => {
		onChange(blocks.map((row) => (row.id === id ? { id, block } : row)));
	};

	const commit = (id: string, node: HTMLElement) => {
		const row = blocks.find((entry) => entry.id === id);
		if (!row) return;

		if (row.block.kind === "heading") {
			const text = serializeBlockText(node);
			if (text !== row.block.text) replaceBlock(id, { ...row.block, text });
			return;
		}

		if (row.block.kind === "text") {
			const html = serializeBlockHtml(node);
			if (html !== row.block.html) replaceBlock(id, { ...row.block, html });
		}
	};

	const rememberRange = (id: string, node: HTMLElement) => {
		const range = rangeWithin(node);
		lastRange.current = range ? { id, range } : null;
	};

	const register = (id: string) => (node: HTMLElement | null) => {
		if (!node) return;
		nodes.current.set(id, node);
		return () => {
			nodes.current.delete(id);
		};
	};

	const lastEditableId = (): string | null => {
		for (let index = blocks.length - 1; index >= 0; index -= 1) {
			const row = blocks[index];
			if (row && isEditableBlock(row.block)) return row.id;
		}
		return null;
	};

	const insertField = (token: string): boolean => {
		const active = lastRange.current;
		const id =
			active && nodes.current.has(active.id) ? active.id : lastEditableId();
		if (!id) return false;

		const node = nodes.current.get(id);
		if (!node) return false;

		insertFieldChip(
			node,
			active?.id === id ? active.range : null,
			token,
			labels,
		);
		rememberRange(id, node);
		commit(id, node);
		return true;
	};

	useImperativeHandle(ref, () => ({ insertField }));

	const remove = (id: string) => {
		nodes.current.delete(id);
		if (lastRange.current?.id === id) lastRange.current = null;
		onChange(blocks.filter((row) => row.id !== id));
	};

	const reorder = (ids: string[]) => {
		const byId = new Map(blocks.map((row) => [row.id, row]));
		const next = ids
			.map((id) => byId.get(id))
			.filter((row): row is EditorBlock => row !== undefined);
		if (next.length !== blocks.length) return;
		onChange(next);
	};

	if (blocks.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>This template is empty.</EmptyTitle>
					<EmptyDescription>
						Add a block from the list on the left.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<SortableList ids={blocks.map((row) => row.id)} onReorder={reorder}>
			<div className="flex flex-col gap-2">
				{blocks.map((row) => (
					<SortableItem
						key={row.id}
						id={row.id}
						label={BLOCK_KIND_LABELS[row.block.kind]}
					>
						<div
							className={ROW}
							data-selected={row.id === selected}
							onFocusCapture={() => setSelected(row.id)}
							onPointerDown={() => setSelected(row.id)}
						>
							<div className="flex items-center gap-2">
								<span className="flex-1 font-medium text-muted-foreground text-xs">
									{BLOCK_KIND_LABELS[row.block.kind]}
								</span>
								<BlockStyleControls
									block={row.block}
									className=""
									onBlock={(next) => replaceBlock(row.id, next)}
								/>
								<Button
									variant="ghost"
									size="icon-xs"
									className={ACTION}
									disabled={blocks.length <= 1}
									onClick={() => remove(row.id)}
								>
									<Icon icon={TrashCan} />
									<span className="sr-only">
										Delete {BLOCK_KIND_LABELS[row.block.kind]}
									</span>
								</Button>
							</div>
							<BlockBody
								row={row}
								labels={labels}
								register={register}
								onRange={rememberRange}
								onCommit={commit}
								onLabel={(label) =>
									replaceBlock(row.id, { kind: "button", label })
								}
								onBlock={(next) => replaceBlock(row.id, next)}
							/>
						</div>
					</SortableItem>
				))}
			</div>
		</SortableList>
	);
}

const ALIGN_OPTIONS: { value: BlockAlign; icon: CarbonIcon; label: string }[] =
	[
		{ value: "left", icon: TextAlignLeftIcon, label: "Align left" },
		{ value: "center", icon: TextAlignCenterIcon, label: "Align centre" },
		{ value: "right", icon: TextAlignRightIcon, label: "Align right" },
	];

const SIZE_LABELS: Record<BlockSize, string> = {
	sm: "S",
	md: "M",
	lg: "L",
	xl: "XL",
};

const HEADING_EDIT_PX: Record<BlockSize, number> = {
	sm: 14,
	md: 16,
	lg: 22,
	xl: 28,
};

const LOGO_EDIT_PX: Record<BlockSize, number> = {
	sm: 24,
	md: 36,
	lg: 56,
	xl: 84,
};

function alignable(block: TemplateBlock): boolean {
	return (
		block.kind === "heading" || block.kind === "text" || block.kind === "logo"
	);
}

function colorable(block: TemplateBlock): boolean {
	return (
		block.kind === "heading" ||
		block.kind === "text" ||
		block.kind === "button" ||
		block.kind === "divider"
	);
}

function sizable(block: TemplateBlock): boolean {
	return block.kind === "heading" || block.kind === "logo";
}

function withSize(block: TemplateBlock, size: BlockSize): TemplateBlock | null {
	if (block.kind === "heading" || block.kind === "logo") {
		return { ...block, size };
	}
	return null;
}

function withAlign(
	block: TemplateBlock,
	align: BlockAlign,
): TemplateBlock | null {
	if (
		block.kind === "heading" ||
		block.kind === "text" ||
		block.kind === "logo"
	) {
		return { ...block, align };
	}
	return null;
}

function withColor(
	block: TemplateBlock,
	color: string | undefined,
): TemplateBlock | null {
	if (
		block.kind === "heading" ||
		block.kind === "text" ||
		block.kind === "button" ||
		block.kind === "divider"
	) {
		if (color === undefined) {
			const { color: _dropped, ...rest } = block;
			return rest;
		}
		return { ...block, color };
	}
	return null;
}

function BlockStyleControls({
	block,
	className,
	onBlock,
}: {
	block: TemplateBlock;
	className: string;
	onBlock: (next: TemplateBlock) => void;
}) {
	if (block.kind === "columns") {
		return (
			<div className={cn("flex items-center gap-0.5", className)}>
				{([2, 3] as const).map((count) => (
					<Button
						key={count}
						variant="ghost"
						size="icon-xs"
						aria-label={`${count} columns`}
						className={cn(
							"font-semibold text-[10px]",
							block.columns.length === count && "bg-muted text-foreground",
						)}
						onClick={() => {
							if (block.columns.length === count) return;
							const columns =
								count > block.columns.length
									? [...block.columns, []]
									: block.columns.slice(0, count);
							onBlock({ ...block, columns });
						}}
					>
						{count}
					</Button>
				))}
			</div>
		);
	}

	if (!alignable(block) && !colorable(block) && !sizable(block)) return null;

	const align = "align" in block ? block.align : undefined;
	const color = "color" in block ? block.color : undefined;
	const size = "size" in block ? block.size : undefined;

	return (
		<div className={cn("flex items-center gap-0.5", className)}>
			{sizable(block) ? (
				<div className="mr-1 flex items-center">
					{(["sm", "md", "lg", "xl"] as const).map((option) => (
						<Button
							key={option}
							variant="ghost"
							size="icon-xs"
							aria-label={`Size ${SIZE_LABELS[option]}`}
							className={cn(
								"font-semibold text-[10px]",
								(size ?? "md") === option && "bg-muted text-foreground",
							)}
							onClick={() => {
								const next = withSize(block, option);
								if (next) onBlock(next);
							}}
						>
							{SIZE_LABELS[option]}
						</Button>
					))}
				</div>
			) : null}
			{alignable(block)
				? ALIGN_OPTIONS.map((option) => (
						<Button
							key={option.value}
							variant="ghost"
							size="icon-xs"
							aria-label={option.label}
							className={cn(
								(align ?? "left") === option.value &&
									"bg-muted text-foreground",
							)}
							onClick={() => {
								const next = withAlign(block, option.value);
								if (next) onBlock(next);
							}}
						>
							<Icon icon={option.icon} />
						</Button>
					))
				: null}
			{colorable(block) ? (
				<label
					className="relative ml-1 flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border"
					aria-label="Block colour"
					style={color ? { backgroundColor: color } : undefined}
				>
					{color ? null : (
						<Icon icon={ColorPalette} className="text-muted-foreground" />
					)}
					<input
						type="color"
						value={color ?? "#111111"}
						onChange={(event) => {
							const next = withColor(block, event.target.value);
							if (next) onBlock(next);
						}}
						className="absolute inset-0 cursor-pointer opacity-0"
					/>
				</label>
			) : null}
			{color ? (
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="Clear colour"
					onClick={() => {
						const next = withColor(block, undefined);
						if (next) onBlock(next);
					}}
				>
					<Icon icon={Close} />
				</Button>
			) : null}
		</div>
	);
}

function BlockBody({
	row,
	labels,
	register,
	onRange,
	onCommit,
	onLabel,
	onBlock,
}: {
	row: EditorBlock;
	labels: MergeFieldLabels;
	register: (id: string) => (node: HTMLElement | null) => void;
	onRange: (id: string, node: HTMLElement) => void;
	onCommit: (id: string, node: HTMLElement) => void;
	onLabel: (label: string) => void;
	onBlock: (next: TemplateBlock) => void;
}) {
	switch (row.block.kind) {
		case "heading":
			return (
				<EditableBlock
					id={row.id}
					kind="heading"
					initial={toEditorText(row.block.text, labels)}
					className="font-semibold"
					style={{
						fontSize: HEADING_EDIT_PX[row.block.size ?? "md"],
						color: row.block.color,
						textAlign: row.block.align,
					}}
					register={register}
					onRange={onRange}
					onCommit={onCommit}
				/>
			);
		case "text":
			return (
				<EditableBlock
					id={row.id}
					kind="text"
					initial={toEditorHtml(row.block.html, labels)}
					className="text-sm"
					style={{ color: row.block.color, textAlign: row.block.align }}
					register={register}
					onRange={onRange}
					onCommit={onCommit}
				/>
			);
		case "button":
			return (
				<div className="flex items-center gap-2">
					<Icon icon={ButtonCentered} className="text-muted-foreground" />
					<Input
						aria-label="Button label"
						value={row.block.label}
						maxLength={TEMPLATE_BLOCKS.button.maxLabelLength}
						onChange={(event) => onLabel(event.target.value)}
					/>
				</div>
			);
		case "logo":
			return <LogoBlockBody size={row.block.size ?? "md"} />;
		case "divider":
			return (
				<div className="flex flex-col gap-2">
					<StaticBody icon={LineThin} note="A line across the page." />
					<Separator />
				</div>
			);
		case "signature":
			return (
				<div className="flex flex-col gap-2">
					<StaticBody
						icon={Pen}
						note="The signature area prints here instead of at the end."
					/>
					<div className="rounded-md border border-dashed px-4 py-5 text-muted-foreground text-xs">
						Signed by ____________________ on ____________
					</div>
				</div>
			);
		case "pageBreak":
			return (
				<StaticBody icon={PageBreak} note="The PDF starts a new page here." />
			);
		case "columns":
			return (
				<ColumnsBody
					block={row.block}
					labels={labels}
					onBlock={(next) => onBlock(next)}
				/>
			);
		default:
			return (
				<StaticBody
					icon={ArrowsVertical}
					note={`${row.block.height}px of empty space.`}
				/>
			);
	}
}

function LogoBlockBody({ size }: { size: BlockSize }) {
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const logoUrl = workspace.data?.logoUrl ?? null;

	if (!logoUrl) {
		return (
			<div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-xs">
				No logo uploaded yet. Add one in Settings, on the General page, under
				Brand.
			</div>
		);
	}

	return (
		// biome-ignore lint/performance/noImgElement: small editor preview of the uploaded logo
		<img
			src={logoUrl}
			alt="Workspace logo"
			style={{ height: LOGO_EDIT_PX[size] }}
			className="w-auto self-start object-contain"
			onError={(event) => {
				event.currentTarget.hidden = true;
			}}
		/>
	);
}

const COLUMN_CHILD_KINDS: TemplateBlockKind[] = [
	"heading",
	"text",
	"logo",
	"divider",
	"spacer",
];

type ColumnsBlock = Extract<TemplateBlock, { kind: "columns" }>;
type ColumnChild = ColumnsBlock["columns"][number][number];

function ColumnsBody({
	block,
	labels,
	onBlock,
}: {
	block: ColumnsBlock;
	labels: MergeFieldLabels;
	onBlock: (next: TemplateBlock) => void;
}) {
	const setColumn = (index: number, children: ColumnChild[]) => {
		onBlock({
			...block,
			columns: block.columns.map((column, i) =>
				i === index ? children : column,
			),
		});
	};

	return (
		<div
			className="grid gap-3"
			style={{
				gridTemplateColumns: `repeat(${block.columns.length}, minmax(0, 1fr))`,
			}}
		>
			{block.columns.map((column, columnIndex) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
					key={columnIndex}
					className="flex min-w-0 flex-col gap-2 rounded-md border border-dashed p-2"
				>
					{column.map((child, childIndex) => (
						<ColumnChildRow
							// biome-ignore lint/suspicious/noArrayIndexKey: children are positional
							key={childIndex}
							child={child}
							labels={labels}
							onChild={(next) =>
								setColumn(
									columnIndex,
									column.map((c, i) => (i === childIndex ? next : c)),
								)
							}
							onMove={(direction) => {
								const target = childIndex + direction;
								if (target < 0 || target >= column.length) return;
								const next = [...column];
								const [moved] = next.splice(childIndex, 1);
								if (moved) next.splice(target, 0, moved);
								setColumn(columnIndex, next);
							}}
							onRemove={() =>
								setColumn(
									columnIndex,
									column.filter((_, i) => i !== childIndex),
								)
							}
						/>
					))}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="self-start">
								<Icon icon={AddIcon} data-icon="inline-start" />
								Add
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{COLUMN_CHILD_KINDS.map((kind) => (
								<DropdownMenuItem
									key={kind}
									onSelect={() =>
										setColumn(columnIndex, [
											...column,
											createTemplateBlock(kind) as ColumnChild,
										])
									}
								>
									{BLOCK_KIND_LABELS[kind]}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			))}
		</div>
	);
}

function ColumnChildRow({
	child,
	labels,
	onChild,
	onMove,
	onRemove,
}: {
	child: ColumnChild;
	labels: MergeFieldLabels;
	onChild: (next: ColumnChild) => void;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	return (
		<div className="flex flex-col gap-1.5 rounded-md border bg-background p-2">
			<div className="flex items-center gap-1">
				<span className="flex-1 text-muted-foreground text-xs">
					{BLOCK_KIND_LABELS[child.kind]}
				</span>
				<BlockStyleControls
					block={child}
					className=""
					onBlock={(next) => onChild(next as ColumnChild)}
				/>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="Move up"
					onClick={() => onMove(-1)}
				>
					<Icon icon={ChevronUp} />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="Move down"
					onClick={() => onMove(1)}
				>
					<Icon icon={ChevronDown} />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="Remove"
					onClick={onRemove}
				>
					<Icon icon={TrashCan} />
				</Button>
			</div>
			{child.kind === "heading" ? (
				<Input
					value={child.text}
					maxLength={TEMPLATE_BLOCKS.heading.maxTextLength}
					style={{
						color: child.color,
						textAlign: child.align,
						fontWeight: 600,
					}}
					onChange={(event) => onChild({ ...child, text: event.target.value })}
				/>
			) : null}
			{child.kind === "text" ? (
				<textarea
					value={child.html}
					rows={2}
					className="w-full resize-y rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
					style={{ color: child.color, textAlign: child.align }}
					onChange={(event) => onChild({ ...child, html: event.target.value })}
				/>
			) : null}
			{child.kind === "logo" ? (
				<LogoBlockBody size={child.size ?? "md"} />
			) : null}
			{child.kind === "divider" ? <Separator /> : null}
			{child.kind === "spacer" ? (
				<StaticBody
					icon={ArrowsVertical}
					note={`${child.height}px of empty space.`}
				/>
			) : null}
		</div>
	);
}

function StaticBody({ icon, note }: { icon: CarbonIcon; note: string }) {
	return (
		<div className="flex items-center gap-2 text-muted-foreground text-xs">
			<Icon icon={icon} />
			<span>{note}</span>
		</div>
	);
}

function EditableBlock({
	id,
	kind,
	initial,
	className,
	style,
	register,
	onRange,
	onCommit,
}: {
	id: string;
	kind: EditableKind;
	initial: string;
	className: string;
	style?: React.CSSProperties;
	register: (id: string) => (node: HTMLElement | null) => void;
	onRange: (id: string, node: HTMLElement) => void;
	onCommit: (id: string, node: HTMLElement) => void;
}) {
	const [html] = useState(initial);
	const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const scheduleCommit = (node: HTMLElement) => {
		clearTimeout(commitTimer.current);
		commitTimer.current = setTimeout(() => onCommit(id, node), 600);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const node = event.currentTarget;

		if (kind === "heading" && event.key === "Enter") {
			event.preventDefault();
			return;
		}

		if (event.key !== "Backspace" && event.key !== "Delete") return;

		const range = rangeWithin(node);
		if (!range) return;

		const chip = fieldChipBeside(range, event.key === "Backspace");
		if (!chip) return;

		event.preventDefault();
		chip.remove();
		onRange(id, node);
		onCommit(id, node);
	};

	const onPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
		event.preventDefault();
		const node = event.currentTarget;
		const text = event.clipboardData.getData("text/plain");
		const flat = kind === "heading" ? text.replace(/\s+/g, " ") : text;
		insertPlainText(node, flat);
		onRange(id, node);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: merge field chips need a contenteditable surface
		<div
			role="textbox"
			aria-multiline={kind === "text"}
			aria-label={kind === "heading" ? "Heading text" : "Paragraph text"}
			tabIndex={0}
			contentEditable
			suppressContentEditableWarning
			ref={register(id)}
			className={cn(EDITABLE, className)}
			style={style}
			onKeyDown={onKeyDown}
			onKeyUp={(event) => onRange(id, event.currentTarget)}
			onMouseUp={(event) => onRange(id, event.currentTarget)}
			onFocus={(event) => onRange(id, event.currentTarget)}
			onInput={(event) => {
				onRange(id, event.currentTarget);
				scheduleCommit(event.currentTarget);
			}}
			onPaste={onPaste}
			onBlur={(event) => {
				clearTimeout(commitTimer.current);
				onCommit(id, event.currentTarget);
			}}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before it reaches the editor
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
