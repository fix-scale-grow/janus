"use client";

import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function AddTaskInput({
	projectId,
	day,
}: {
	projectId: string;
	day: Date | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [name, setName] = useState("");

	const create = useMutation(
		trpc.projects.taskCreate.mutationOptions({
			onSuccess: () => {
				setName("");
				void cache.project(projectId);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="px-1 opacity-70 transition-opacity focus-within:opacity-100 hover:opacity-100">
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					const trimmed = name.trim();
					if (!trimmed) return;
					create.mutate({ projectId, name: trimmed, day });
				}}
				placeholder="Add a task…"
				disabled={create.isPending}
			/>
		</div>
	);
}
