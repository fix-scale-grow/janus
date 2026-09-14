export type ReportKpiTone = "default" | "warning" | "destructive";

export type ReportKpi = {
	key: string;
	label: string;
	value: string;
	tone?: ReportKpiTone;
};

export type ReportSeriesPoint = {
	x: string;
	[series: string]: string | number;
};

export type ReportEnvelope<Row> = {
	kpis: ReportKpi[];
	series: ReportSeriesPoint[];
	rows: Row[];
	excluded: number;
};
