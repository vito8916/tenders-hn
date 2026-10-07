import { siteConfig } from "@/lib/site";

export function LegalPage({
	title,
	summary,
	children,
}: {
	title: string;
	summary: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
			<header className="flex flex-col gap-3 border-b pb-8">
				<p className="font-mono text-xs font-medium tracking-wider text-accent-blue uppercase">
					Última actualización: {siteConfig.legalUpdatedAt}
				</p>
				<h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">{title}</h1>
				<p className="text-base text-pretty text-muted-foreground md:text-lg">{summary}</p>
			</header>

			<article className="text-[0.9375rem] leading-7 text-pretty text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-medium [&_h3]:text-foreground [&_li]:pl-1 [&_p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:mt-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
				{children}
			</article>
		</div>
	);
}
