export const BOARD_PAGE_SIZE = 100;

type BoardNeutralized = {
	q: string;
	status: string;
	owner: string;
	stage: string;
	closing: string;
	page: number;
	pageSize: number;
};

export function boardListInput<T extends BoardNeutralized>(input: T): T {
	return {
		...input,
		q: "",
		status: "all",
		owner: "all",
		stage: "all",
		closing: "all",
		page: 1,
		pageSize: BOARD_PAGE_SIZE,
	};
}
