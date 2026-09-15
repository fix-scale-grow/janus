"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { TEAM_TABS, type TeamTab, teamTabParsers } from "./team-search-params";

function isTeamTab(value: string): value is TeamTab {
	return (TEAM_TABS as readonly string[]).includes(value);
}

export function TeamTabs({
	members,
	groups,
	crews,
}: {
	members: ReactNode;
	groups: ReactNode;
	crews: ReactNode;
}) {
	const [tab, setTab] = useQueryState("tab", teamTabParsers.tab);

	return (
		<Tabs
			value={tab}
			onValueChange={(next) => {
				if (isTeamTab(next)) void setTab(next);
			}}
		>
			<TabsList variant="line">
				<TabsTrigger value={TEAM_TABS[0]}>Members</TabsTrigger>
				<TabsTrigger value={TEAM_TABS[1]}>Groups</TabsTrigger>
				<TabsTrigger value={TEAM_TABS[2]}>Crews</TabsTrigger>
			</TabsList>

			<TabsContent value="members">{members}</TabsContent>
			<TabsContent value="groups">{groups}</TabsContent>
			<TabsContent value="crews">{crews}</TabsContent>
		</Tabs>
	);
}
