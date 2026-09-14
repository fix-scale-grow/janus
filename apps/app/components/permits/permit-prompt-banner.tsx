"use client";

import Add from "@carbon/icons-react/es/Add";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";

type JurisdictionGuess = { name: string; state: string } | null;

export function PermitPromptBanner({
	jurisdictionGuess,
	neededWhen,
	neededWhenVerified,
	onOpenPermit,
	onDismiss,
	dismissing,
}: {
	jurisdictionGuess: JurisdictionGuess;
	neededWhen: string | null;
	neededWhenVerified: boolean | null;
	onOpenPermit: () => void;
	onDismiss: () => void;
	dismissing: boolean;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
			<div className="flex items-start gap-2">
				<Icon
					icon={WarningAlt}
					className="mt-0.5 size-4 shrink-0 text-warning"
				/>
				<div className="flex min-w-0 flex-col gap-1">
					<p className="text-sm">
						{jurisdictionGuess
							? `This job may need a building permit in ${jurisdictionGuess.name}, ${jurisdictionGuess.state}.`
							: "This job may need a building permit."}
					</p>
					{neededWhen ? (
						<p className="text-muted-foreground text-sm">
							{neededWhen}{" "}
							{neededWhenVerified === false ? (
								<Badge variant="outline">Unverified</Badge>
							) : null}{" "}
							<span className="text-muted-foreground/80">
								Verify in Settings › Permits.
							</span>
						</p>
					) : null}
				</div>
			</div>
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={dismissing}
					onClick={onDismiss}
				>
					{dismissing ? <Spinner data-icon="inline-start" /> : null}
					Dismiss
				</Button>
				<Button type="button" size="sm" onClick={onOpenPermit}>
					<Icon icon={Add} data-icon="inline-start" />
					Open a permit
				</Button>
			</div>
		</div>
	);
}
