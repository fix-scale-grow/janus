"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import {
	NavBarItem,
	NavBarItemChevron,
	NavBarItemIcon,
} from "@crm/ui/components/nav-bar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function QuickCreateMenu({ variant }: { variant: "rail" | "bar" }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const [creatingProject, setCreatingProject] = useState(false);

	const createEstimate = useMutation(
		trpc.estimates.create.mutationOptions({
			onSuccess: (estimate) => {
				void cache.estimate(estimate.id);
				router.push(workspaceUrl(`/estimates/${estimate.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const createDrawing = useMutation(
		trpc.drawings.create.mutationOptions({
			onSuccess: (drawing) => {
				void cache.drawing(drawing.id);
				router.push(workspaceUrl(`/drawings/${drawing.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const items: { label: string; onSelect: () => void }[] = [
		{
			label: "New contact",
			onSelect: () => router.push(workspaceUrl("/contacts?new=1")),
		},
		{
			label: "New deal",
			onSelect: () => router.push(workspaceUrl("/deals?new=1")),
		},
		{
			label: "New project",
			onSelect: () => setCreatingProject(true),
		},
		{
			label: "New drawing",
			onSelect: () => createDrawing.mutate({ background: "WHITEBOARD" }),
		},
		{
			label: "New estimate",
			onSelect: () => createEstimate.mutate({}),
		},
	];

	return (
		<>
			<DropdownMenu>
				{variant === "rail" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-label="New"
									className="text-muted-foreground"
								>
									<Icon icon={Add} />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="right">New</TooltipContent>
					</Tooltip>
				) : (
					<DropdownMenuTrigger asChild>
						<NavBarItem asChild hasChildren>
							<button type="button">
								<NavBarItemIcon icon={Add} />
								New
								<NavBarItemChevron />
							</button>
						</NavBarItem>
					</DropdownMenuTrigger>
				)}
				<DropdownMenuContent align="start" className="min-w-44">
					{items.map((item) => (
						<DropdownMenuItem key={item.label} onSelect={item.onSelect}>
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<NewProjectDialog
				open={creatingProject}
				onOpenChange={setCreatingProject}
			/>
		</>
	);
}
