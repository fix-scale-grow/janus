"use client";

import type { TemplatePurpose } from "@crm/db/enums";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "./client";

type Settle = "all" | "record";

type Options = {
	settle?: Settle;
};

type RecordKind = "company" | "contact" | "deal";

type RemovedRecord = { kind: RecordKind; id: string };

type RemovedRecords = { kind: RecordKind; ids: string[] };

export type CrmCache = {
	company(id?: string, options?: Options): Promise<void>;
	contact(id?: string, options?: Options): Promise<void>;
	deal(id?: string, options?: Options): Promise<void>;
	drawing(id?: string, options?: Options): Promise<void>;
	estimate(id?: string, options?: Options): Promise<void>;
	invoice(id?: string, options?: Options): Promise<void>;
	project(id?: string, options?: Options): Promise<void>;
	service(id?: string, options?: Options): Promise<void>;
	symbol(id?: string, options?: Options): Promise<void>;
	template(purpose?: TemplatePurpose, options?: Options): Promise<void>;
	fields(entity?: RecordKind, options?: Options): Promise<void>;
	fieldCoverage(id?: string, options?: Options): Promise<void>;
	removed(record: RemovedRecord): Promise<void>;
	removedMany(records: RemovedRecords): Promise<void>;
	conversationRemoved(id: string): Promise<void>;
	activity(options?: Options): Promise<void>;
	google(options?: Options): Promise<void>;
	microsoft(options?: Options): Promise<void>;
	settings(options?: Options): Promise<void>;
	currency(options?: Options): Promise<void>;
	workspace(options?: Options): Promise<void>;
	slack(options?: Options): Promise<void>;
	sso(options?: Options): Promise<void>;
	tracking(options?: Options): Promise<void>;
	everything(): Promise<void>;
};

export function useCrmCache(): CrmCache {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const run = (
		record: QueryKey[],
		rest: QueryKey[],
		{ settle = "all" }: Options = {},
	): Promise<void> => {
		const awaited = settle === "all" ? [...record, ...rest] : record;
		const behind = settle === "all" ? [] : rest;

		for (const queryKey of behind) {
			void queryClient.invalidateQueries({ queryKey });
		}

		return Promise.all(
			awaited.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);
	};

	const activityKeys = () => [
		trpc.activities.timeline.pathKey(),
		trpc.activities.timelineCounts.queryKey(),
		trpc.activities.myTasks.queryKey(),
	];

	const listKeys = () => [
		trpc.companies.list.queryKey(),
		trpc.contacts.list.queryKey(),
		trpc.deals.list.queryKey(),
		trpc.search.quick.queryKey(),
	];

	const removeRecords = (kind: RecordKind, ids: string[]): Promise<void> => {
		const byId = {
			company: trpc.companies.byId,
			contact: trpc.contacts.byId,
			deal: trpc.deals.byId,
		}[kind];
		const goneKeys = ids.map((id) => byId.queryKey({ id }));
		const gone = new Set(goneKeys.map((key) => JSON.stringify(key)));

		for (const record of [
			trpc.companies.byId,
			trpc.contacts.byId,
			trpc.deals.byId,
		]) {
			void queryClient.invalidateQueries({
				queryKey: record.queryKey(),
				predicate: (query) => !gone.has(JSON.stringify(query.queryKey)),
			});
		}

		for (const queryKey of goneKeys) {
			void queryClient.invalidateQueries({
				queryKey,
				exact: true,
				refetchType: "none",
			});
		}

		return run(
			[...listKeys(), ...activityKeys(), trpc.dashboard.summary.queryKey()],
			[],
		);
	};

	const RECORD_BY_ID = {
		company: () => trpc.companies.byId.queryKey(),
		contact: () => trpc.contacts.byId.queryKey(),
		deal: () => trpc.deals.byId.queryKey(),
	} as const;

	const RECORD_LIST = {
		company: () => trpc.companies.list.queryKey(),
		contact: () => trpc.contacts.list.queryKey(),
		deal: () => trpc.deals.list.queryKey(),
	} as const;

	return {
		fields: (entity, options) =>
			run(
				[trpc.fields.list.queryKey()],
				entity
					? [RECORD_BY_ID[entity](), RECORD_LIST[entity]()]
					: [...Object.values(RECORD_BY_ID).map((key) => key()), ...listKeys()],
				options,
			),

		fieldCoverage: (id, options) =>
			run(
				[
					id
						? trpc.fields.coverage.queryKey({ id })
						: trpc.fields.coverage.queryKey(),
				],
				[],
				options,
			),

		company: (id, options) =>
			run(
				[
					id
						? trpc.companies.byId.queryKey({ id })
						: trpc.companies.byId.queryKey(),
				],
				[
					...listKeys(),
					trpc.contacts.byId.queryKey(),
					trpc.deals.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		contact: (id, options) =>
			run(
				[
					id
						? trpc.contacts.byId.queryKey({ id })
						: trpc.contacts.byId.queryKey(),
				],
				[
					...listKeys(),
					trpc.companies.byId.queryKey(),
					trpc.deals.byId.queryKey(),
					trpc.deals.contactOptions.queryKey(),
				],
				options,
			),

		deal: (id, options) =>
			run(
				[id ? trpc.deals.byId.queryKey({ id }) : trpc.deals.byId.queryKey()],
				[
					...listKeys(),
					trpc.deals.contactOptions.queryKey(),
					trpc.companies.byId.queryKey(),
					trpc.contacts.byId.queryKey(),
					...activityKeys(),
					trpc.dashboard.summary.queryKey(),
					trpc.currency.settings.queryKey(),
				],
				options,
			),

		drawing: (id, options) =>
			run(
				[
					id
						? trpc.drawings.byId.queryKey({ id })
						: trpc.drawings.byId.queryKey(),
				],
				[trpc.drawings.list.queryKey()],
				options,
			),

		estimate: (id, options) =>
			run(
				[
					id
						? trpc.estimates.byId.queryKey({ id })
						: trpc.estimates.byId.queryKey(),
				],
				[trpc.estimates.list.queryKey()],
				options,
			),

		invoice: (id, options) =>
			run(
				[
					id
						? trpc.invoices.byId.queryKey({ id })
						: trpc.invoices.byId.queryKey(),
				],
				[trpc.invoices.list.queryKey()],
				options,
			),

		project: (id, options) =>
			run(
				[
					id
						? trpc.projects.byId.queryKey({ id })
						: trpc.projects.byId.queryKey(),
				],
				[trpc.projects.list.queryKey()],
				options,
			),

		service: (id, options) =>
			run(
				[
					id
						? trpc.services.byId.queryKey({ id })
						: trpc.services.byId.queryKey(),
				],
				[trpc.services.list.queryKey()],
				options,
			),

		symbol: (id, options) =>
			run(
				[
					id
						? trpc.symbols.byId.queryKey({ id })
						: trpc.symbols.byId.queryKey(),
				],
				[trpc.symbols.list.queryKey()],
				options,
			),

		template: (purpose, options) =>
			run(
				[
					purpose
						? trpc.templates.byPurpose.queryKey({ purpose })
						: trpc.templates.byPurpose.queryKey(),
				],
				[trpc.templates.list.queryKey(), trpc.templates.preview.pathKey()],
				options,
			),

		removed: ({ kind, id }) => removeRecords(kind, [id]),

		removedMany: ({ kind, ids }) => removeRecords(kind, ids),

		conversationRemoved: (id) => {
			for (const queryKey of [
				trpc.conversations.builderById.queryKey({ id }),
				trpc.conversations.events.queryKey({ id }),
				trpc.conversations.shareStatus.queryKey({ id }),
			]) {
				void queryClient.invalidateQueries({
					queryKey,
					exact: true,
					refetchType: "none",
				});
			}

			return run([trpc.conversations.builderList.pathKey()], []);
		},

		activity: (options) =>
			run(
				activityKeys(),
				[
					...listKeys(),
					trpc.companies.byId.queryKey(),
					trpc.contacts.byId.queryKey(),
					trpc.deals.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		google: (options) =>
			run(
				[trpc.google.status.queryKey()],
				[
					...activityKeys(),
					...listKeys(),
					trpc.companies.byId.queryKey(),
					trpc.contacts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		microsoft: (options) =>
			run(
				[trpc.microsoft.status.queryKey()],
				[
					...activityKeys(),
					...listKeys(),
					trpc.companies.byId.queryKey(),
					trpc.contacts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		settings: (options) =>
			run(
				[
					trpc.settings.agentModel.queryKey(),
					trpc.settings.researchKey.queryKey(),
				],
				[],
				options,
			),

		currency: (options) =>
			run(
				[trpc.currency.settings.queryKey()],
				[
					...listKeys(),
					trpc.deals.byId.queryKey(),
					trpc.companies.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		workspace: (options) =>
			run(
				[trpc.workspace.get.queryKey(), trpc.workspace.members.queryKey()],
				[],
				options,
			),

		slack: (options) =>
			run(
				[trpc.slack.status.queryKey(), trpc.slack.matches.queryKey()],
				[],
				options,
			),

		sso: (options) =>
			run(
				[trpc.sso.list.pathKey()],
				[trpc.sso.settings.queryKey(), trpc.sso.signInOptions.queryKey()],
				options,
			),

		tracking: (options) =>
			run(
				[trpc.tracking.settings.queryKey()],
				[trpc.tracking.sources.queryKey()],
				options,
			),

		everything: () => queryClient.invalidateQueries(),
	};
}
