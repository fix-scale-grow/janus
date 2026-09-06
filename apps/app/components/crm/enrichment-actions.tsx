"use client";

import Renew from "@carbon/icons-react/es/Renew";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function ContactEnrichmentAction({ contactId }: { contactId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const enrich = useMutation(
		trpc.contacts.enrich.mutationOptions({
			onSuccess: async () => {
				await cache.contact(contactId);
				toast.success(
					"Taking another look — this page will update when it finishes.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Button
			variant="outline"
			size="sm"
			disabled={enrich.isPending}
			onClick={() => enrich.mutate({ id: contactId })}
		>
			{enrich.isPending ? (
				<Spinner />
			) : (
				<Icon icon={Renew} data-icon="inline-start" />
			)}
			<span className="hidden sm:inline">Re-enrich</span>
		</Button>
	);
}
