export function WaitingForGroup() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
			<p className="font-medium text-sm">Waiting for access</p>
			<p className="text-muted-foreground text-xs">
				An admin needs to put you in a group before you can see anything here.
			</p>
		</div>
	);
}
