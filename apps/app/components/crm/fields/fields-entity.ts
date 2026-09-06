import type { RecordKind } from "@/components/crm/record-sheet/record-stack";

export type FieldEntity = "CONTACT" | "DEAL";

const TO_ENTITY: Record<RecordKind, FieldEntity> = {
	contact: "CONTACT",
	deal: "DEAL",
};

const TO_KIND: Record<FieldEntity, RecordKind> = {
	CONTACT: "contact",
	DEAL: "deal",
};

export function entityOf(kind: RecordKind): FieldEntity {
	return TO_ENTITY[kind];
}

export function kindOf(entity: FieldEntity): RecordKind {
	return TO_KIND[entity];
}
