import Building from "@carbon/icons-react/es/Building";
import type { CarbonIconType } from "@carbon/icons-react/es/CarbonIcon";
import Chat from "@carbon/icons-react/es/Chat";
import Dashboard from "@carbon/icons-react/es/Dashboard";
import Partnership from "@carbon/icons-react/es/Partnership";
import Settings from "@carbon/icons-react/es/Settings";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";

/**
 * Janus product IA — the single source of truth for the app shell navigation.
 *
 * The module set is the blue-collar contract defined by the v0 design suite
 * (`design/v0-suite/components/shell/sidebar.tsx`). `live` modules are wired to
 * real engine routes today; `planned` modules are recorded here so the IA stays
 * in one place and each is flipped to `live` as its screen is ported in later
 * Foundation / phase work. Keep this list — not the rail component — as the place
 * to add or promote a module.
 */

export type NavMatch = "exact" | "prefix";
export type NavStatus = "live" | "planned";

export type JanusModule = {
	title: string;
	href: string;
	match: NavMatch;
	status: NavStatus;
	icon?: CarbonIconType;
	related?: string[];
	/** v0-suite source route this module ports from (design contract). */
	source?: string;
};

/** A module already wired to a real engine route; guaranteed to carry an icon. */
export type LiveNavItem = JanusModule & {
	status: "live";
	icon: CarbonIconType;
};

export const JANUS_NAV: JanusModule[] = [
	// --- live: wired to real engine routes ---
	{
		title: "Dashboard",
		href: "/",
		match: "exact",
		status: "live",
		icon: Dashboard,
		source: "app/(app)/dashboard",
	},
	{
		title: "Janus AI",
		href: "/chat",
		match: "prefix",
		status: "live",
		icon: Chat,
		related: ["/agents"],
		source: "app/(app)/janus",
	},
	{
		title: "Companies",
		href: "/companies",
		match: "prefix",
		status: "live",
		icon: Building,
		source: "app/(app)/contacts",
	},
	{
		title: "Contacts",
		href: "/contacts",
		match: "prefix",
		status: "live",
		icon: UserMultiple,
		source: "app/(app)/contacts",
	},
	{
		title: "Sales",
		href: "/deals",
		match: "prefix",
		status: "live",
		icon: Partnership,
		source: "app/(app)/sales",
	},
	{
		title: "Settings",
		href: "/settings",
		match: "prefix",
		status: "live",
		icon: Settings,
		source: "app/(app)/settings",
	},
	// --- planned: ported in subsequent stages (see JANUS.md phases) ---
	{
		title: "Production",
		href: "/production",
		match: "prefix",
		status: "planned",
		source: "app/(app)/production",
	},
	{
		title: "Schedule",
		href: "/schedule",
		match: "prefix",
		status: "planned",
		source: "app/(app)/schedule",
	},
	{
		title: "Inbox",
		href: "/inbox",
		match: "prefix",
		status: "planned",
		source: "app/(app)/inbox",
	},
	{
		title: "Estimates",
		href: "/estimates",
		match: "prefix",
		status: "planned",
		source: "app/(app)/estimates",
	},
	{
		title: "Invoices",
		href: "/invoices",
		match: "prefix",
		status: "planned",
		source: "app/(app)/invoices",
	},
	{
		title: "Automations",
		href: "/automations",
		match: "prefix",
		status: "planned",
		source: "app/(app)/automations",
	},
	{
		title: "Phone Agent",
		href: "/phone-agent",
		match: "prefix",
		status: "planned",
		source: "app/(app)/phone-agent",
	},
];

/** Modules rendered in the shell today — real routes only, never dead links. */
export const JANUS_LIVE_NAV: LiveNavItem[] = JANUS_NAV.filter(
	(m): m is LiveNavItem => m.status === "live" && Boolean(m.icon),
);
