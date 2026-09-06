"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardPanel,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useState } from "react";
import {
	ENTITY_TABS,
	NEW_FIELD,
	subtitleFor,
} from "@/components/crm/fields/fields-copy";
import { entityOf } from "@/components/crm/fields/fields-entity";
import { FieldsBody } from "@/components/crm/fields/fields-sheet";
import type { RecordKind } from "@/components/crm/record-sheet/record-stack";

export function FieldsSettings() {
	const [kind, setKind] = useState<RecordKind>("contact");
	const [field, setField] = useState<string | null>(null);

	const entity = entityOf(kind);
	const label = ENTITY_TABS.find((tab) => tab.kind === kind)?.label ?? "";

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{field ? (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setField(null)}
							>
								<Icon icon={ArrowLeft} />
								<span className="sr-only">Back</span>
							</Button>
							{field === "new" ? NEW_FIELD : label}
						</div>
					) : (
						label
					)}
				</CardTitle>
				<CardDescription>{subtitleFor(kind)}</CardDescription>
				<CardAction>
					<Tabs
						value={kind}
						onValueChange={(next) => {
							setKind(next as RecordKind);
							setField(null);
						}}
					>
						<TabsList>
							{ENTITY_TABS.map((tab) => (
								<TabsTrigger key={tab.kind} value={tab.kind}>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>

			<CardPanel>
				<FieldsBody entity={entity} field={field} onEdit={setField} />
			</CardPanel>
		</Card>
	);
}
