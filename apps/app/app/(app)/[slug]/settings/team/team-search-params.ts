import { createLoader, parseAsStringLiteral } from "nuqs/server";

export const TEAM_TABS = ["members", "groups", "crews"] as const;

export type TeamTab = (typeof TEAM_TABS)[number];

export const teamTabParsers = {
	tab: parseAsStringLiteral(TEAM_TABS).withDefault("members"),
};

export const loadTeamSearchParams = createLoader(teamTabParsers);
