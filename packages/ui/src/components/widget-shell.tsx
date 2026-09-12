"use client";

import Close from "@carbon/icons-react/es/Close";
import Draggable from "@carbon/icons-react/es/Draggable";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
} from "react";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";

type WidgetEditingContextValue = { editing: boolean; onRemove?: () => void };

const WidgetEditingContext = createContext<WidgetEditingContextValue>({
	editing: false,
});

export function WidgetEditingProvider({
	editing,
	onRemove,
	children,
}: WidgetEditingContextValue & { children: ReactNode }) {
	const value = useMemo(
		() => ({ editing, onRemove }),
		[editing, onRemove],
	);

	return (
		<WidgetEditingContext.Provider value={value}>
			{children}
		</WidgetEditingContext.Provider>
	);
}

export function useWidgetEditing(): WidgetEditingContextValue {
	return useContext(WidgetEditingContext);
}

export function WidgetShell({
	title,
	description,
	action,
	editing,
	onRemove,
	children,
}: {
	title: string;
	description?: ReactNode;
	action?: ReactNode;
	editing?: boolean;
	onRemove?: () => void;
	children: ReactNode;
}) {
	const context = useWidgetEditing();
	const isEditing = editing ?? context.editing;
	const handleRemove = onRemove ?? context.onRemove;

	return (
		<Card
			className={cn(
				"min-w-0 h-full flex flex-col border border-primary/20 dark:border-primary/15",
				isEditing && "border-dashed hover:ring-1 hover:ring-ring/50",
			)}
		>
			<CardHeader className="px-4 pt-4 md:px-6">
				<div className="flex items-center gap-2">
					{isEditing ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<span
									className="janus-widget-drag flex cursor-grab items-center justify-center rounded-sm bg-secondary p-1 text-muted-foreground hover:bg-accent"
									aria-hidden
								>
									<Icon icon={Draggable} />
								</span>
							</TooltipTrigger>
							<TooltipContent>Drag to move</TooltipContent>
						</Tooltip>
					) : null}
					<CardTitle>{title}</CardTitle>
				</div>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{action || isEditing ? (
					<CardAction>
						{action}
						{isEditing ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={handleRemove}
									>
										<Icon icon={Close} />
										<span className="sr-only">Remove {title}</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Remove widget</TooltipContent>
							</Tooltip>
						) : null}
					</CardAction>
				) : null}
			</CardHeader>
			<div className="flex flex-1 flex-col min-h-0 overflow-hidden">
				{children}
			</div>
		</Card>
	);
}

export function WidgetError({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
			<p className="text-muted-foreground text-xs">
				This widget could not load.
			</p>
			<Button type="button" variant="outline" size="sm" onClick={onRetry}>
				Retry
			</Button>
		</div>
	);
}
