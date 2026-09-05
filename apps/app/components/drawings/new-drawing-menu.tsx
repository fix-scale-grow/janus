"use client";

import Add from "@carbon/icons-react/es/Add";
import Draw from "@carbon/icons-react/es/Draw";
import Image from "@carbon/icons-react/es/Image";
import PenFountain from "@carbon/icons-react/es/PenFountain";
import Satellite from "@carbon/icons-react/es/Satellite";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Background = "WHITEBOARD" | "IMAGE" | "SATELLITE";

type MenuItem = {
	label: string;
	icon: CarbonIcon;
	background: Background;
	tool?: "freedraw";
};

const ITEMS: MenuItem[] = [
	{ label: "Whiteboard", icon: Draw, background: "WHITEBOARD" },
	{ label: "From photo", icon: Image, background: "IMAGE" },
	{ label: "Satellite", icon: Satellite, background: "SATELLITE" },
	{
		label: "Quick note",
		icon: PenFountain,
		background: "WHITEBOARD",
		tool: "freedraw",
	},
];

export function NewDrawingMenu({
	dealId,
	contactId,
	size,
}: {
	dealId?: string;
	contactId?: string;
	size?: "default" | "sm";
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const pendingTool = useRef<"freedraw" | null>(null);

	const create = useMutation(
		trpc.drawings.create.mutationOptions({
			onSuccess: (drawing) => {
				void cache.drawing(drawing.id);
				const tool = pendingTool.current;
				pendingTool.current = null;
				const query = tool ? `?tool=${tool}` : "";
				router.push(`${workspaceUrl(`/drawings/${drawing.id}`)}${query}`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const createDrawing = (item: MenuItem) => {
		pendingTool.current = item.tool ?? null;
		create.mutate({ background: item.background, dealId, contactId });
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size={size} disabled={create.isPending}>
					<Icon icon={Add} data-icon="inline-start" />
					New drawing
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{ITEMS.map((item) => (
					<DropdownMenuItem
						key={item.label}
						disabled={create.isPending}
						onSelect={() => createDrawing(item)}
					>
						<Icon icon={item.icon} />
						{item.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
