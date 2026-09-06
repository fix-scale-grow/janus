"use client";

import { Button } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

const CANVAS_HEIGHT = 160;

type SignatureMode = "typed" | "drawn";

type Point = { x: number; y: number };

export function SigningView({
	token,
	title,
	number,
	bodyHtml,
}: {
	token: string;
	title: string;
	number: number;
	bodyHtml: string;
}) {
	const trpc = useTRPC();
	const nameId = useId();

	const [mode, setMode] = useState<SignatureMode>("typed");
	const [signerName, setSignerName] = useState("");
	const [hasDrawing, setHasDrawing] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const strokeRef = useRef<{ drawing: boolean; last: Point | null }>({
		drawing: false,
		last: null,
	});

	const sign = useMutation(trpc.contractSigning.sign.mutationOptions());

	if (sign.isSuccess) {
		return (
			<Card>
				<CardContent>
					<div className="flex flex-col items-center gap-2 text-center">
						<p className="text-base/6 font-medium text-foreground">
							Signed. Thank you.
						</p>
						<p className="text-sm/5 text-muted-foreground">
							A signed copy has been sent to your email.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const trimmedName = signerName.trim();
	const canSubmit = trimmedName.length > 0 && (mode === "typed" || hasDrawing);

	function setupCanvas(canvas: HTMLCanvasElement | null) {
		canvasRef.current = canvas;
		if (!canvas) return;

		const ratio = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * ratio;
		canvas.height = CANVAS_HEIGHT * ratio;
		canvas.getContext("2d")?.scale(ratio, ratio);
	}

	function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
		const rect = event.currentTarget.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		strokeRef.current = { drawing: true, last: pointFromEvent(event) };
	}

	function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
		if (!strokeRef.current.drawing) return;

		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;

		const next = pointFromEvent(event);
		const last = strokeRef.current.last ?? next;

		ctx.strokeStyle = getComputedStyle(canvas).color;
		ctx.lineWidth = 2;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(last.x, last.y);
		ctx.lineTo(next.x, next.y);
		ctx.stroke();

		strokeRef.current.last = next;
		setHasDrawing(true);
	}

	function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
		strokeRef.current = { drawing: false, last: null };
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	function handleClear() {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (canvas && ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
		setHasDrawing(false);
	}

	function handleSubmit() {
		if (trimmedName.length === 0) {
			setFormError("Enter your full name to sign.");
			return;
		}

		if (mode === "drawn" && !hasDrawing) {
			setFormError("Draw your signature to sign.");
			return;
		}

		setFormError(null);

		const signatureData =
			mode === "typed"
				? trimmedName
				: canvasRef.current?.toDataURL("image/png");

		if (mode === "drawn" && !signatureData) {
			setFormError("Draw your signature to sign.");
			return;
		}

		sign.mutate({
			token,
			signerName: trimmedName,
			signatureKind: mode,
			signatureData: signatureData ?? trimmedName,
		});
	}

	return (
		<>
			<Card>
				<CardContent>
					<div
						className="overflow-x-auto"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: bodyHtml is rendered server-side from the contract's own merge-field template, not user input
						dangerouslySetInnerHTML={{ __html: bodyHtml }}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent>
					<div className="flex flex-col gap-1 text-center">
						<p className="text-sm/5 font-medium text-foreground">{title}</p>
						<p className="text-xs/4 text-muted-foreground">
							Contract #{number}
						</p>
					</div>

					<Field>
						<FieldLabel htmlFor={nameId}>Your full legal name</FieldLabel>
						<Input
							id={nameId}
							value={signerName}
							onChange={(event) => setSignerName(event.target.value)}
							placeholder="Jane Doe"
							autoComplete="name"
							disabled={sign.isPending}
						/>
					</Field>

					<Tabs
						value={mode}
						onValueChange={(next) => {
							setMode(next as SignatureMode);
							setFormError(null);
						}}
					>
						<TabsList>
							<TabsTrigger value="typed">Type</TabsTrigger>
							<TabsTrigger value="drawn">Draw</TabsTrigger>
						</TabsList>

						<TabsContent value="typed">
							<div className="flex items-center justify-center rounded-md border bg-background px-4 py-6">
								<span className="font-serif text-2xl italic text-foreground">
									{trimmedName || "Your signature"}
								</span>
							</div>
						</TabsContent>

						<TabsContent value="drawn">
							<div className="flex flex-col gap-2">
								<canvas
									ref={setupCanvas}
									className="h-40 w-full touch-none rounded-md border bg-background text-foreground"
									onPointerDown={handlePointerDown}
									onPointerMove={handlePointerMove}
									onPointerUp={handlePointerUp}
									onPointerLeave={handlePointerUp}
								/>
								<div className="flex justify-end">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleClear}
										disabled={sign.isPending}
									>
										Clear
									</Button>
								</div>
							</div>
						</TabsContent>
					</Tabs>

					{formError ? (
						<p role="alert" className="text-xs font-normal text-destructive">
							{formError}
						</p>
					) : null}

					{sign.error ? (
						<p role="alert" className="text-xs font-normal text-destructive">
							{sign.error.message}
						</p>
					) : null}

					<Button
						className="w-full"
						disabled={sign.isPending || !canSubmit}
						onClick={handleSubmit}
					>
						{sign.isPending ? <Spinner data-icon="inline-start" /> : null}
						Agree & sign
					</Button>
				</CardContent>
			</Card>
		</>
	);
}
