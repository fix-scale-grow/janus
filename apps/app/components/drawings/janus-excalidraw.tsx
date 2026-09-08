"use client";

import "@excalidraw/excalidraw/index.css";

import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";

export const JanusExcalidraw = dynamic(
	async () => {
		const { Excalidraw: ExcalidrawComponent, MainMenu } = await import(
			"@excalidraw/excalidraw"
		);
		const menu = (
			<MainMenu>
				<MainMenu.DefaultItems.Export />
				<MainMenu.DefaultItems.ChangeCanvasBackground />
				<MainMenu.DefaultItems.ClearCanvas />
			</MainMenu>
		);
		return function JanusExcalidraw(exProps: ExcalidrawProps) {
			return <ExcalidrawComponent {...exProps}>{menu}</ExcalidrawComponent>;
		};
	},
	{ ssr: false },
);
