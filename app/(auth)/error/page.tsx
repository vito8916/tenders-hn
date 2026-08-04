import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";

async function ErrorContent({
	searchParams,
}: {
	searchParams: Promise<{ error: string }>;
}) {
	const params = await searchParams;

	return (
		<>
			<div className="flex items-start gap-3">
				<AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
				<div className="flex-1">
					{params?.error ? (
						<p className="text-sm text-foreground">
							{params.error}
						</p>
					) : (
						<p className="text-sm text-foreground">
							An unspecified error occurred.
						</p>
					)}
				</div>
			</div>
		</>
	);
}

export default function Page({
	searchParams,
}: {
	searchParams: Promise<{ error: string }>;
}) {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl">
							Authentication Error
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Suspense fallback={<Spinner className="size-8" />}>
							<ErrorContent searchParams={searchParams} />
						</Suspense>
					</CardContent>
					<CardFooter>
						<Button asChild className="w-full">
							<Link href="/">Back to Home</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
