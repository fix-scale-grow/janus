"use client";

import Copy from "@carbon/icons-react/es/Copy";
import Launch from "@carbon/icons-react/es/Launch";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { useState } from "react";
import { toast } from "sonner";
import {
	COPY,
	EMBED_SNIPPET_LABEL,
	EMBED_TITLE,
	HOSTED_LINK_LABEL,
	OPEN,
	TEST_IT_NOTE,
} from "./forms-copy";

function copy(value: string) {
	const clipboard = navigator.clipboard;
	if (!clipboard) {
		toast.error("Could not copy. Select it instead.");
		return;
	}
	clipboard
		.writeText(value)
		.then(() => toast.success("Copied."))
		.catch(() => toast.error("Could not copy."));
}

export function FormEmbed({ formId }: { formId: string; formName: string }) {
	const [origin] = useState(() =>
		typeof window === "undefined" ? "" : window.location.origin,
	);

	const scriptUrl = `${origin}/f/${formId}.js`;
	const hostedUrl = `${origin}/f/${formId}`;
	const snippet = `<script src="${scriptUrl}" async></script>`;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{EMBED_TITLE}</CardTitle>
				<CardDescription>{EMBED_SNIPPET_LABEL}</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => copy(snippet)}>
						<Icon icon={Copy} data-icon="inline-start" />
						{COPY}
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<pre className="overflow-x-auto rounded-md border bg-muted p-4 font-mono text-code-foreground text-xs/5">
					<span className="text-code-accent">{"<script"}</span>
					{"\n  src="}
					<span className="text-code-string">{`"${scriptUrl}"`}</span>
					{"\n  async\n"}
					<span className="text-code-accent">{"></script>"}</span>
				</pre>

				<div className="flex items-center justify-between gap-3 rounded-md border p-3">
					<div className="min-w-0">
						<p className="font-medium text-sm">{HOSTED_LINK_LABEL}</p>
						<p className="truncate text-muted-foreground text-xs">
							{hostedUrl}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => copy(hostedUrl)}
						>
							<Icon icon={Copy} data-icon="inline-start" />
							{COPY}
						</Button>
						<Button type="button" variant="outline" size="sm" asChild>
							<a href={hostedUrl} target="_blank" rel="noreferrer">
								<Icon icon={Launch} data-icon="inline-start" />
								{OPEN}
							</a>
						</Button>
					</div>
				</div>

				<p className="text-muted-foreground text-xs/relaxed">{TEST_IT_NOTE}</p>
			</CardContent>
		</Card>
	);
}
