export const CREW_COLOR_CLASSES: Record<string, { bar: string; dot: string }> =
	{
		red: { bar: "bg-red-100 text-red-900 border-red-300", dot: "bg-red-500" },
		orange: {
			bar: "bg-orange-100 text-orange-900 border-orange-300",
			dot: "bg-orange-500",
		},
		amber: {
			bar: "bg-amber-100 text-amber-900 border-amber-300",
			dot: "bg-amber-500",
		},
		green: {
			bar: "bg-green-100 text-green-900 border-green-300",
			dot: "bg-green-500",
		},
		teal: {
			bar: "bg-teal-100 text-teal-900 border-teal-300",
			dot: "bg-teal-500",
		},
		sky: { bar: "bg-sky-100 text-sky-900 border-sky-300", dot: "bg-sky-500" },
		indigo: {
			bar: "bg-indigo-100 text-indigo-900 border-indigo-300",
			dot: "bg-indigo-500",
		},
		violet: {
			bar: "bg-violet-100 text-violet-900 border-violet-300",
			dot: "bg-violet-500",
		},
		pink: {
			bar: "bg-pink-100 text-pink-900 border-pink-300",
			dot: "bg-pink-500",
		},
		slate: {
			bar: "bg-slate-100 text-slate-900 border-slate-300",
			dot: "bg-slate-500",
		},
	};

export const NO_CREW_CLASSES = {
	bar: "bg-muted text-foreground border-border",
	dot: "bg-muted-foreground",
};
