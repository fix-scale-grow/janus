"use client";

import Search from "@carbon/icons-react/es/Search";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { parseAsBoolean, useQueryState } from "nuqs";

export function SearchPill({ variant }: { variant: "bar" | "rail" }) {
	const [, setOpen] = useQueryState("k", parseAsBoolean.withDefault(false));

	if (variant === "rail") {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Search or ask Janus"
						className="text-muted-foreground"
						onClick={() => void setOpen(true)}
					>
						<Icon icon={Search} />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="right">
					Search or ask Janus <kbd className="ml-1">⌘K</kbd>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Button
			variant="outline"
			size="sm"
			className="w-full max-w-64 justify-start gap-2 text-muted-foreground"
			onClick={() => void setOpen(true)}
		>
			<Icon icon={Search} />
			<span className="min-w-0 flex-1 truncate text-left">
				Search or ask Janus…
			</span>
			<kbd className="hidden shrink-0 rounded-sm border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
				⌘K
			</kbd>
		</Button>
	);
}
