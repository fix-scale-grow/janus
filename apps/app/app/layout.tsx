import "@crm/ui/globals.css";
import { Toaster } from "@crm/ui/components/sonner";
import { TooltipProvider } from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { BrandTheme } from "@/components/brand-theme";
import { LocalDateTimeHydrator } from "@/components/local-date-time";
import { ThemeProvider } from "@/components/theme-provider";
import { readInstallBrandTheme } from "@/lib/brand";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { workspaceLabel } from "@/lib/workspace-label";

export const instant = false;

const fontSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const fontMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
	const theme = await readInstallBrandTheme();
	const label = workspaceLabel(theme?.name);

	return {
		title: {
			default: label,
			template: `%s · ${label}`,
		},
		description: `Customer Relationship Management for ${label}`,
		icons: {
			icon: [
				{ url: "/favicon.svg", type: "image/svg+xml" },
				{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
			],
			apple: "/apple-touch-icon.png",
		},
		manifest: "/site.webmanifest",
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const theme = await readInstallBrandTheme();

	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={cn(fontSans.variable, fontMono.variable, "h-full antialiased")}
		>
			<head>
				<BrandTheme brandColor={theme?.brandColor} />
			</head>
			<body className="flex min-h-full flex-col font-sans">
				<NuqsAdapter>
					<TRPCReactProvider>
						<ThemeProvider>
							<TooltipProvider>{children}</TooltipProvider>
							<Toaster richColors />
						</ThemeProvider>
					</TRPCReactProvider>
				</NuqsAdapter>
				<LocalDateTimeHydrator />
			</body>
		</html>
	);
}
