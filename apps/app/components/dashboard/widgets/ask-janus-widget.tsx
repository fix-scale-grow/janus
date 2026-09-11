"use client";

import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { WidgetShell } from "@crm/ui/components/widget-shell";
import { useState } from "react";
import { AgentPanel } from "@/components/crm/agent-panel";
import { recordCopy } from "@/lib/agent-record";

export function AskJanusWidget() {
	const copy = recordCopy("workspace");
	const [question, setQuestion] = useState("");
	const [open, setOpen] = useState(false);
	const [initialMessage, setInitialMessage] = useState<string | undefined>();

	return (
		<WidgetShell title={copy.title} description="Your CRM, one question away">
			<form
				className="flex min-w-0 flex-1 items-center gap-2 p-4"
				onSubmit={(event) => {
					event.preventDefault();
					const trimmed = question.trim();
					setInitialMessage(trimmed.length > 0 ? trimmed : undefined);
					setQuestion("");
					setOpen(true);
				}}
			>
				<Input
					value={question}
					onChange={(event) => setQuestion(event.target.value)}
					placeholder={copy.placeholder}
				/>
				<Button type="submit" size="sm">
					Ask
				</Button>
			</form>

			<Sheet
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setInitialMessage(undefined);
				}}
			>
				<SheetContent className="gap-0 p-0" size="lg">
					<SheetHeader className="border-b">
						<SheetTitle>{copy.title}</SheetTitle>
					</SheetHeader>
					<AgentPanel
						record={{ kind: "workspace", id: "workspace" }}
						initialMessage={initialMessage}
					/>
				</SheetContent>
			</Sheet>
		</WidgetShell>
	);
}
