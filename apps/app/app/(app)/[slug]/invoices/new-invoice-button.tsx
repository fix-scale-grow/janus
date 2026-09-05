"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function NewInvoiceButton({
	dealId,
	contactId,
	size,
}: {
	dealId?: string;
	contactId?: string;
	size?: "default" | "sm";
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const create = useMutation(
		trpc.invoices.create.mutationOptions({
			onSuccess: (invoice) => {
				void cache.invoice(invoice.id);
				router.push(workspaceUrl(`/invoices/${invoice.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Button
			size={size}
			disabled={create.isPending}
			onClick={() => create.mutate({ dealId, contactId })}
		>
			<Icon icon={Add} data-icon="inline-start" />
			New invoice
		</Button>
	);
}
