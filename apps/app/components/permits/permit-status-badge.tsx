import { Badge } from "@crm/ui/components/badge";
import {
	PERMIT_STATUS_LABEL,
	type PermitStatus,
} from "@/lib/permits/permit-status";

const PERMIT_STATUS_VARIANT: Record<
	PermitStatus,
	"secondary" | "outline" | "destructive"
> = {
	DRAFT: "secondary",
	READY_TO_SUBMIT: "outline",
	SUBMITTED: "outline",
	ISSUED: "secondary",
	INSPECTIONS: "outline",
	CLOSED: "secondary",
	DENIED: "destructive",
	EXPIRED: "destructive",
};

export function PermitStatusBadge({ status }: { status: PermitStatus }) {
	return (
		<Badge variant={PERMIT_STATUS_VARIANT[status]}>
			{PERMIT_STATUS_LABEL[status]}
		</Badge>
	);
}
