"use client";

import { Spinner } from "@crm/ui/components/spinner";
import { WidgetError } from "@crm/ui/components/widget-shell";
import { useQuery } from "@tanstack/react-query";
import {
	Component,
	createContext,
	type ReactNode,
	useContext,
	useMemo,
} from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

export type Summary = RouterOutputs["dashboard"]["summary"];

type SummaryContextValue = {
	summary: Summary | undefined;
	scope: Summary["scope"];
	isError: boolean;
	refetchSummary: () => void;
};

const SummaryContext = createContext<SummaryContextValue | null>(null);

export function SummaryProvider({
	scope,
	children,
}: {
	scope: Summary["scope"];
	children: ReactNode;
}) {
	const trpc = useTRPC();
	const summaryQuery = useQuery({
		...trpc.dashboard.summary.queryOptions({ scope }),
		placeholderData: (previous) => previous,
	});

	const value = useMemo<SummaryContextValue>(
		() => ({
			summary: summaryQuery.data,
			scope,
			isError: summaryQuery.isError,
			refetchSummary: () => {
				void summaryQuery.refetch();
			},
		}),
		[summaryQuery.data, summaryQuery.isError, summaryQuery.refetch, scope],
	);

	return (
		<SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
	);
}

export function useSummary(): SummaryContextValue {
	const ctx = useContext(SummaryContext);
	if (!ctx) {
		throw new Error("useSummary must be used within a SummaryProvider");
	}
	return ctx;
}

export function SummarySpinnerRow() {
	return (
		<div className="flex flex-1 items-center justify-center py-12">
			<Spinner />
		</div>
	);
}

type WidgetBoundaryState = { hasError: boolean };

export class WidgetBoundary extends Component<
	{ onRetry: () => void; children: ReactNode },
	WidgetBoundaryState
> {
	state: WidgetBoundaryState = { hasError: false };

	static getDerivedStateFromError(): WidgetBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error) {
		console.error(error);
	}

	render() {
		if (this.state.hasError) {
			return (
				<WidgetError
					onRetry={() => {
						this.setState({ hasError: false });
						this.props.onRetry();
					}}
				/>
			);
		}
		return this.props.children;
	}
}
