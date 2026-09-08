"use client";

import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQueryState } from "nuqs";
import type { SavedTableView } from "@/components/data-table/list-search-params";
import { ProjectsCalendar } from "./projects-calendar";
import {
	type ProjectsView as ProjectsViewValue,
	projectsViewParser,
} from "./projects-search-params";
import { ProjectsTable } from "./projects-table";

export function ProjectsView({ savedState }: { savedState?: SavedTableView }) {
	const [view, setView] = useQueryState("view", projectsViewParser);

	const toggle = (
		<ToggleGroup
			type="single"
			value={view}
			onValueChange={(next) => next && void setView(next as ProjectsViewValue)}
		>
			<ToggleGroupItem value="table">Table</ToggleGroupItem>
			<ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
		</ToggleGroup>
	);

	if (view === "calendar") {
		return <ProjectsCalendar viewToggle={toggle} />;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex justify-end">{toggle}</div>
			<ProjectsTable savedState={savedState} />
		</div>
	);
}
