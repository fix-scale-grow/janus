import { StageOutcome } from "@crm/db";

export const NEW_PIPELINE_STAGES = [
	{
		label: "New lead",
		color: "var(--chart-1)",
		outcome: StageOutcome.OPEN,
		isEntry: true,
	},
	{
		label: "Won",
		color: "var(--swatch-1)",
		outcome: StageOutcome.WON,
		isEntry: false,
	},
	{
		label: "Lost",
		color: "var(--swatch-2)",
		outcome: StageOutcome.LOST,
		isEntry: false,
	},
] as const;
