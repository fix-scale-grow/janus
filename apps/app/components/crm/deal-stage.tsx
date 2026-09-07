import { StatusIndicator } from "@crm/ui/components/status-indicator";
import type { StagePresentation } from "@/lib/stage-presentation";
import { stageToneFallback } from "@/lib/stage-presentation";

export function DealStageIndicator({
	stage,
	className,
}: {
	stage: StagePresentation;
	className?: string;
}) {
	return (
		<StatusIndicator
			tone={stageToneFallback(stage.outcome)}
			color={stage.color}
			label={stage.label}
			className={className}
		/>
	);
}
