const QUESTION_WORDS = [
	"who",
	"what",
	"which",
	"when",
	"why",
	"how",
	"should",
	"can",
	"is",
	"are",
	"do",
	"does",
] as const;

export function isQuestionShaped(q: string): boolean {
	const trimmed = q.trim();
	if (trimmed.length === 0) return false;
	if (trimmed.endsWith("?")) return true;

	const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
	return (QUESTION_WORDS as readonly string[]).includes(firstWord);
}
