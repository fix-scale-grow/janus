export function nameMatchesLocalPart(
	person: { firstName: string | null; lastName: string | null },
	local: string,
): boolean {
	const first = normalise(person.firstName ?? "");
	const last = normalise(person.lastName ?? "");
	const handle = normalise(local);

	if (!handle || (!first && !last)) return false;

	const forms = [
		`${first}${last}`,
		`${last}${first}`,
		`${first.slice(0, 1)}${last}`,
		`${last}${first.slice(0, 1)}`,
		`${first}${last.slice(0, 1)}`,
		first,
		last,
	].filter(Boolean);

	return forms.some(
		(form) =>
			form === handle || form.startsWith(handle) || handle.startsWith(form),
	);
}

export function isDerivedName(
	email: string | null,
	firstName: string,
	lastName: string | null,
): boolean {
	if (!email || lastName !== null) return false;
	const local = email.split("@")[0] ?? "";
	return nameMatchesLocalPart({ firstName, lastName: null }, local);
}

export function splitName(
	fullName: string,
): { firstName: string; lastName: string | null } | null {
	const cleaned = fullName.trim().replace(/\s+/g, " ");
	if (!cleaned) return null;

	const [first, ...rest] = cleaned.split(" ");
	if (!first) return null;

	return { firstName: first, lastName: rest.length ? rest.join(" ") : null };
}

export function normalise(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
