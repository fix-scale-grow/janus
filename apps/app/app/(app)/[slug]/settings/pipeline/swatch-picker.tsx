"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { cn } from "@crm/ui/lib/utils";
import { STAGE_COLOR_LABEL } from "./pipeline-copy";
import { STAGE_SWATCHES } from "./stage-swatches";

export { STAGE_SWATCHES };

export function SwatchPicker({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (color: string) => void;
	disabled?: boolean;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					disabled={disabled}
					className="shrink-0 rounded-full"
				>
					<span
						className="size-3 rounded-full"
						style={{ backgroundColor: value }}
					/>
					<span className="sr-only">{STAGE_COLOR_LABEL}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent size="fit" className="p-2.5">
				<div className="grid grid-cols-6 gap-1.5">
					{STAGE_SWATCHES.map((swatch) => (
						<button
							key={swatch}
							type="button"
							onClick={() => onChange(swatch)}
							className={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-foreground/10",
								swatch === value && "ring-2 ring-foreground/60",
							)}
							style={{ backgroundColor: swatch }}
						>
							{swatch === value ? (
								<Icon icon={Checkmark} className="text-background" />
							) : null}
							<span className="sr-only">{swatch}</span>
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
