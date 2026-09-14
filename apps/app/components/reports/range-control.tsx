"use client";

import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { fromDay, toDay } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useQueryStates } from "nuqs";
import {
	presetRange,
	type ReportRangePreset,
	reportRangeParsers,
} from "@/lib/reports/range";

const PRESET_LABEL: Record<ReportRangePreset, string> = {
	"30d": "30 days",
	"90d": "90 days",
	"12m": "12 months",
	custom: "Custom",
};

export function RangeControl() {
	const [range, setRange] = useQueryStates(reportRangeParsers);

	const choosePreset = (preset: ReportRangePreset) => {
		if (preset === "custom") {
			setRange({ preset });
			return;
		}
		const { from, to } = presetRange(preset, new Date());
		setRange({ preset, from, to });
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-1 rounded-md border bg-muted p-0.5">
				{(["30d", "90d", "12m", "custom"] as const).map((preset) => (
					<Button
						key={preset}
						type="button"
						variant={range.preset === preset ? "default" : "ghost"}
						size="sm"
						className={cn(
							range.preset !== preset && "bg-transparent shadow-none",
						)}
						onClick={() => choosePreset(preset)}
					>
						{PRESET_LABEL[preset]}
					</Button>
				))}
			</div>

			{range.preset === "custom" ? (
				<div className="flex items-center gap-2">
					<div className="w-40">
						<DatePicker
							value={range.from ? toDay(range.from) : undefined}
							onChange={(next) =>
								setRange({ from: next ? (fromDay(next) ?? null) : null })
							}
							placeholder="From"
						/>
					</div>
					<div className="w-40">
						<DatePicker
							value={range.to ? toDay(range.to) : undefined}
							onChange={(next) =>
								setRange({ to: next ? (fromDay(next) ?? null) : null })
							}
							placeholder="To"
						/>
					</div>
				</div>
			) : null}
		</div>
	);
}
