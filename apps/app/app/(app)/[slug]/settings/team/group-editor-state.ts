import type {
	AccessArea,
	AccessLevel,
	AccessScope,
	AccessSurface,
	MoneySwitch,
	StandaloneAction,
} from "@crm/db/access-config";
import { ACCESS } from "@crm/db/access-config";
import type { AccessPolicy } from "@crm/db/access-policy";

const UNBUILT_ACTIONS: readonly StandaloneAction[] = ["contracts.signInPerson"];

export const EDITOR_ACTIONS: readonly StandaloneAction[] =
	ACCESS.actions.filter((action) => !UNBUILT_ACTIONS.includes(action));

export type GroupDraft = {
	id: string | null;
	name: string;
	surface: AccessSurface;
	scope: AccessScope;
	scopeBeforeField: AccessScope | null;
	policy: AccessPolicy;
};

export type GroupEditorAction =
	| { type: "setName"; name: string }
	| { type: "setSurface"; surface: AccessSurface }
	| { type: "setScope"; scope: AccessScope }
	| { type: "setLevel"; area: AccessArea; level: AccessLevel }
	| { type: "toggleAction"; action: StandaloneAction }
	| { type: "toggleMoney"; money: MoneySwitch }
	| { type: "reset"; draft: GroupDraft };

function toggle<T>(list: readonly T[], item: T): T[] {
	return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function groupEditorReducer(
	state: GroupDraft,
	action: GroupEditorAction,
): GroupDraft {
	switch (action.type) {
		case "reset":
			return action.draft;
		case "setName":
			return { ...state, name: action.name };
		case "setSurface":
			if (action.surface === state.surface) return state;
			if (action.surface === "FIELD") {
				return state.scope === "ALL"
					? {
							...state,
							surface: action.surface,
							scope: "ASSIGNED",
							scopeBeforeField: state.scope,
						}
					: { ...state, surface: action.surface };
			}
			return {
				...state,
				surface: action.surface,
				scope: state.scopeBeforeField ?? state.scope,
				scopeBeforeField: null,
			};
		case "setScope":
			return { ...state, scope: action.scope, scopeBeforeField: null };
		case "setLevel": {
			const level =
				ACCESS.viewOnlyAreas.includes(action.area) &&
				(action.level === "EDIT" || action.level === "DELETE")
					? "VIEW"
					: action.level;
			return {
				...state,
				policy: {
					...state.policy,
					areas: { ...state.policy.areas, [action.area]: level },
				},
			};
		}
		case "toggleAction":
			return {
				...state,
				policy: {
					...state.policy,
					actions: toggle(state.policy.actions, action.action),
				},
			};
		case "toggleMoney":
			return {
				...state,
				policy: {
					...state.policy,
					money: toggle(state.policy.money, action.money),
				},
			};
	}
}
