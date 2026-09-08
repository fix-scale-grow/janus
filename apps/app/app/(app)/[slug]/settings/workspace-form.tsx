"use client";

import ImageIcon from "@carbon/icons-react/es/Image";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Upload from "@carbon/icons-react/es/Upload";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import {
	normalizeHex,
	readableForeground,
	relativeLuminance,
} from "@crm/ui/lib/brand-theme";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceSlug } from "@/lib/use-workspace-url";
import { workspaceUrl } from "@/lib/workspace-url";

const DEFAULT_BRAND_COLOR = "#006b4f";

const LOGO_ACCEPT = "image/png,image/svg+xml,image/jpeg,image/webp";

type Workspace = RouterOutputs["workspace"]["get"];

export function WorkspaceForm() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const slug = useWorkspaceSlug();

	const nameId = useId();
	const websiteId = useId();

	const workspace = useQuery(trpc.workspace.get.queryOptions());

	const [draft, setDraft] = useState<{ name: string; website: string } | null>(
		null,
	);

	const save = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: async (saved) => {
				await cache.workspace();
				setDraft(null);
				toast.success("Workspace saved.");

				if (saved.slug !== slug) {
					router.replace(workspaceUrl(saved.slug, "/settings"));
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!workspace.data) return null;

	const { name, website, canRename } = workspace.data;

	const values = draft ?? { name, website: website ?? "" };
	const dirty = values.name !== name || values.website !== (website ?? "");

	const edit = (patch: Partial<typeof values>) =>
		setDraft({ ...values, ...patch });

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Workspace</CardTitle>
					<CardDescription>
						The name and website of the company using this CRM.
					</CardDescription>

					<CardAction>
						<Button
							type="submit"
							form="workspace"
							disabled={
								!canRename ||
								save.isPending ||
								!dirty ||
								values.name.trim() === "" ||
								values.website.trim() === ""
							}
						>
							{save.isPending ? <Spinner data-icon="inline-start" /> : null}
							Save
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					<form
						id="workspace"
						onSubmit={(event) => {
							event.preventDefault();
							save.mutate({
								name: values.name,
								website: values.website.trim(),
							});
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={nameId}>Name</FieldLabel>
								<Input
									id={nameId}
									value={values.name}
									onChange={(event) => edit({ name: event.target.value })}
									placeholder="Acme Inc."
									autoComplete="organization"
									disabled={!canRename || save.isPending}
									required
								/>
								<FieldDescription>
									Shown wherever the CRM refers to your own company.
								</FieldDescription>
							</Field>

							<Field>
								<FieldLabel htmlFor={websiteId}>Website</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<InputGroupText>https://</InputGroupText>
									</InputGroupAddon>
									<InputGroupInput
										id={websiteId}
										value={values.website}
										onChange={(event) => edit({ website: event.target.value })}
										placeholder="acme.com"
										autoComplete="off"
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
										inputMode="url"
										disabled={!canRename || save.isPending}
									/>
								</InputGroup>
								<FieldDescription>Your own company's website.</FieldDescription>
							</Field>
						</FieldGroup>
					</form>

					{canRename ? null : (
						<p className="text-muted-foreground text-xs">
							Only an owner or an admin can change this.
						</p>
					)}
				</CardContent>
			</Card>

			<BrandCard workspace={workspace.data} />
		</>
	);
}

function BrandCard({ workspace }: { workspace: Workspace }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();

	const colorId = useId();
	const fileInput = useRef<HTMLInputElement>(null);

	const { name, website, brandColor, logoUrl, canRename } = workspace;

	const [colorDraft, setColorDraft] = useState<string | null>(null);

	const savedColor = brandColor ?? DEFAULT_BRAND_COLOR;
	const colorValue = colorDraft ?? savedColor;
	const normalized = normalizeHex(colorValue);
	const previewHex = normalized ?? savedColor;
	const previewForeground = readableForeground(previewHex);
	const colorDirty = colorDraft !== null && colorDraft !== savedColor;
	const tooPale = relativeLuminance(previewHex) > 0.85;

	const saveColor = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				setColorDraft(null);
				router.refresh();
				toast.success("Brand color saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const uploadLogo = useMutation({
		mutationFn: async (file: File) => {
			const body = new FormData();
			body.set("file", file);
			const response = await fetch("/api/workspace/logo", {
				method: "POST",
				body,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => null);
				throw new Error(data?.error ?? "The logo could not be uploaded.");
			}
		},
		onSuccess: async () => {
			await cache.workspace();
			router.refresh();
			toast.success("Logo saved.");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const removeLogo = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/workspace/logo", {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("The logo could not be removed.");
			}
		},
		onSuccess: async () => {
			await cache.workspace();
			router.refresh();
			toast.success("Logo removed.");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const previewStyle = {
		"--primary": previewHex,
		"--primary-foreground": previewForeground,
		"--ring": previewHex,
	} as CSSProperties;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Brand</CardTitle>
				<CardDescription>
					The accent color and logo Janus uses across the app and in emails.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={colorId}>Accent color</FieldLabel>
						<div className="flex items-center gap-2">
							<input
								type="color"
								aria-label="Accent color"
								value={previewHex}
								onChange={(event) => setColorDraft(event.target.value)}
								disabled={!canRename || saveColor.isPending}
								className="h-9 w-10 shrink-0 rounded-md border border-input"
							/>
							<Input
								id={colorId}
								value={colorValue}
								onChange={(event) => setColorDraft(event.target.value)}
								placeholder={DEFAULT_BRAND_COLOR}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={!canRename || saveColor.isPending}
								className="w-32"
							/>
							<Button
								type="button"
								size="sm"
								disabled={
									!canRename ||
									saveColor.isPending ||
									!colorDirty ||
									!normalized
								}
								onClick={() =>
									saveColor.mutate({
										name,
										website: website ?? "",
										brandColor: normalized,
									})
								}
							>
								{saveColor.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Save
							</Button>
						</div>
						<FieldDescription>
							Used for primary buttons, the sidebar and links across the app and
							in emails.
						</FieldDescription>
					</Field>

					{tooPale ? (
						<Alert variant="warning">
							<Icon icon={Warning} />
							<AlertTitle>Too pale to read white text</AlertTitle>
							<AlertDescription>
								Janus will use dark text on it.
							</AlertDescription>
						</Alert>
					) : null}

					<div
						style={previewStyle}
						className="flex items-center gap-3 rounded-md border p-3"
					>
						<Button size="sm">Sample</Button>
						<Badge>Sample</Badge>
						<div
							className="size-6 shrink-0 rounded-full ring-2 ring-ring ring-offset-2 ring-offset-background"
							aria-hidden
						/>
					</div>

					<Field>
						<FieldLabel>Logo</FieldLabel>
						<div className="flex items-center gap-3">
							<div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
								{logoUrl ? (
									<NextImage
										src={logoUrl}
										alt={name}
										fill
										sizes="56px"
										className="object-contain"
										unoptimized
									/>
								) : (
									<Icon icon={ImageIcon} className="text-muted-foreground" />
								)}
							</div>

							<input
								ref={fileInput}
								type="file"
								accept={LOGO_ACCEPT}
								className="hidden"
								onChange={(event) => {
									const file = event.currentTarget.files?.[0];
									event.currentTarget.value = "";
									if (file) uploadLogo.mutate(file);
								}}
							/>

							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canRename || uploadLogo.isPending}
								onClick={() => fileInput.current?.click()}
							>
								{uploadLogo.isPending ? (
									<Spinner data-icon="inline-start" />
								) : (
									<Icon icon={Upload} data-icon="inline-start" />
								)}
								Upload logo
							</Button>

							{logoUrl ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={!canRename || removeLogo.isPending}
									onClick={() => removeLogo.mutate()}
								>
									{removeLogo.isPending ? (
										<Spinner data-icon="inline-start" />
									) : (
										<Icon icon={TrashCan} data-icon="inline-start" />
									)}
									Remove
								</Button>
							) : null}
						</div>
						<FieldDescription>
							PNG, SVG, JPEG or WebP, up to 2 MB. Shown in the app shell, the
							sign-in page and emails.
						</FieldDescription>
					</Field>
				</FieldGroup>

				{canRename ? null : (
					<p className="text-muted-foreground text-xs">
						Only an owner or an admin can change this.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
