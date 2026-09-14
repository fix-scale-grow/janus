"use client";

export function ExcludedDisclosure({ excluded }: { excluded: number }) {
	if (excluded <= 0) return null;

	return (
		<p className="text-muted-foreground text-sm">
			{excluded} {excluded === 1 ? "entry" : "entries"} in other currencies are
			not included.
		</p>
	);
}
