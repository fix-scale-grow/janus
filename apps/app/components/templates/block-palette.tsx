"use client";

import ArrowsVertical from "@carbon/icons-react/es/ArrowsVertical";
import ButtonCentered from "@carbon/icons-react/es/ButtonCentered";
import Image from "@carbon/icons-react/es/Image";
import LineThin from "@carbon/icons-react/es/LineThin";
import TextAlignLeft from "@carbon/icons-react/es/TextAlignLeft";
import TextFont from "@carbon/icons-react/es/TextFont";
import type { TemplatePurpose } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import {
	BLOCK_KIND_LABELS,
	blockKindsFor,
	type TemplateBlockKind,
} from "./merge-fields";

const BLOCK_KIND_ICONS: Record<TemplateBlockKind, CarbonIcon> = {
	heading: TextFont,
	text: TextAlignLeft,
	button: ButtonCentered,
	logo: Image,
	divider: LineThin,
	spacer: ArrowsVertical,
};

export function BlockPalette({
	purpose,
	onAdd,
}: {
	purpose: TemplatePurpose;
	onAdd: (kind: TemplateBlockKind) => void;
}) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-4">
			<div className="flex flex-col gap-0.5">
				<h2 className="font-medium text-sm">Blocks</h2>
				<p className="text-muted-foreground text-xs">
					Click a block to add it to the end.
				</p>
			</div>
			<div className="flex flex-col gap-1.5">
				{blockKindsFor(purpose).map((kind) => (
					<Button
						key={kind}
						variant="outline"
						size="sm"
						className="w-full justify-start"
						onClick={() => onAdd(kind)}
					>
						<Icon icon={BLOCK_KIND_ICONS[kind]} data-icon="inline-start" />
						{BLOCK_KIND_LABELS[kind]}
					</Button>
				))}
			</div>
		</div>
	);
}
