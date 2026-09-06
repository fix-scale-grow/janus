"use client";

import ArrowsVertical from "@carbon/icons-react/es/ArrowsVertical";
import ButtonCentered from "@carbon/icons-react/es/ButtonCentered";
import Image from "@carbon/icons-react/es/Image";
import LineThin from "@carbon/icons-react/es/LineThin";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
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
import type {
	KeyboardEvent,
	ClipboardEvent as ReactClipboardEvent,
	Ref,
} from "react";
import { useImperativeHandle, useRef, useState } from "react";
import {
	fieldChipBeside,
	insertFieldChip,
	insertPlainText,
	rangeWithin,
	serializeBlockHtml,
	serializeBlockText,
	toEditorHtml,
	toEditorText,
} from "./block-serialize";
import {
	BLOCK_KIND_LABELS,
	isEditableBlock,
	TEMPLATE_BLOCKS,
	type TemplateBlock,
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
	ref,
}: {
	blocks: EditorBlock[];
	onChange: (next: EditorBlock[]) => void;
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
			if (text !== row.block.text) replaceBlock(id, { kind: "heading", text });
			return;
		}

		if (row.block.kind === "text") {
			const html = serializeBlockHtml(node);
			if (html !== row.block.html) replaceBlock(id, { kind: "text", html });
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

		insertFieldChip(node, active?.id === id ? active.range : null, token);
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
								register={register}
								onRange={rememberRange}
								onCommit={commit}
								onLabel={(label) =>
									replaceBlock(row.id, { kind: "button", label })
								}
							/>
						</div>
					</SortableItem>
				))}
			</div>
		</SortableList>
	);
}

function BlockBody({
	row,
	register,
	onRange,
	onCommit,
	onLabel,
}: {
	row: EditorBlock;
	register: (id: string) => (node: HTMLElement | null) => void;
	onRange: (id: string, node: HTMLElement) => void;
	onCommit: (id: string, node: HTMLElement) => void;
	onLabel: (label: string) => void;
}) {
	switch (row.block.kind) {
		case "heading":
			return (
				<EditableBlock
					id={row.id}
					kind="heading"
					initial={toEditorText(row.block.text)}
					className="font-semibold text-base"
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
					initial={toEditorHtml(row.block.html)}
					className="text-sm"
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
			return (
				<StaticBody
					icon={Image}
					note="Your business logo, centred at the top."
				/>
			);
		case "divider":
			return (
				<div className="flex flex-col gap-2">
					<StaticBody icon={LineThin} note="A line across the email." />
					<Separator />
				</div>
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
	register,
	onRange,
	onCommit,
}: {
	id: string;
	kind: EditableKind;
	initial: string;
	className: string;
	register: (id: string) => (node: HTMLElement | null) => void;
	onRange: (id: string, node: HTMLElement) => void;
	onCommit: (id: string, node: HTMLElement) => void;
}) {
	const [html] = useState(initial);

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
			onKeyDown={onKeyDown}
			onKeyUp={(event) => onRange(id, event.currentTarget)}
			onMouseUp={(event) => onRange(id, event.currentTarget)}
			onFocus={(event) => onRange(id, event.currentTarget)}
			onInput={(event) => onRange(id, event.currentTarget)}
			onPaste={onPaste}
			onBlur={(event) => onCommit(id, event.currentTarget)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before it reaches the editor
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
