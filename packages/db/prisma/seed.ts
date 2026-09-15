import { db } from "../src/client";
import { seedDemo } from "./demo-data";

async function main() {
	const result = await seedDemo();

	console.log(
		`Seeded 2 pipelines, ${result.stages} stages, ` +
			`${result.contacts} contacts, ${result.deals} deals, ` +
			`${result.activities} activities.`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
