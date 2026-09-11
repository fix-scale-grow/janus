"use client";

import Add from "@carbon/icons-react/es/Add";
import Edit from "@carbon/icons-react/es/Edit";
import Reset from "@carbon/icons-react/es/Reset";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import type { DashboardWidget } from "@/lib/dashboard/dashboard-edit-context";
import { useDashboardEdit } from "@/lib/dashboard/dashboard-edit-context";

function AddWidgetRow({
	widget,
	onAdd,
}: {
	widget: DashboardWidget;
	onAdd: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-2 py-1.5">
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{widget.title}</span>
				{widget.description ? (
					<span className="truncate text-muted-foreground">
						{widget.description}
					</span>
				) : null}
			</div>
			<Button variant="outline" size="xs" onClick={onAdd}>
				<Icon icon={Add} />
				Add
			</Button>
		</div>
	);
}

export function CustomiseControls() {
	const { editing, addable, savePending, customise, cancel, done, reset, add } =
		useDashboardEdit();

	if (!editing) {
		return (
			<Button variant="outline" size="sm" onClick={customise}>
				<Icon icon={Edit} />
				Customise
			</Button>
		);
	}

	const boardWidgets = addable.filter(
		(widget) => widget.instanceOf === "pipeline-board",
	);
	const otherWidgets = addable.filter(
		(widget) => widget.instanceOf !== "pipeline-board",
	);

	return (
		<div className="flex items-center gap-2">
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm">
						<Icon icon={Add} />
						Add widget
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-80">
					{addable.length === 0 ? (
						<p className="text-muted-foreground">
							Every widget is on the dashboard.
						</p>
					) : (
						<div className="flex flex-col gap-3">
							{otherWidgets.length > 0 ? (
								<div className="flex flex-col divide-y">
									{otherWidgets.map((widget) => (
										<AddWidgetRow
											key={widget.id}
											widget={widget}
											onAdd={() => add(widget)}
										/>
									))}
								</div>
							) : null}
							{boardWidgets.length > 0 ? (
								<div className="flex flex-col gap-1.5">
									<span className="text-muted-foreground text-xs">
										Pipeline boards
									</span>
									<div className="flex flex-col divide-y">
										{boardWidgets.map((widget) => (
											<AddWidgetRow
												key={widget.id}
												widget={widget}
												onAdd={() => add(widget)}
											/>
										))}
									</div>
								</div>
							) : null}
						</div>
					)}
				</PopoverContent>
			</Popover>
			<Button variant="outline" size="sm" onClick={reset}>
				<Icon icon={Reset} />
				Reset
			</Button>
			<div className="w-2" />
			<Button variant="ghost" size="sm" onClick={cancel} disabled={savePending}>
				Cancel
			</Button>
			<Button variant="default" size="sm" onClick={done} disabled={savePending}>
				Done
			</Button>
		</div>
	);
}
