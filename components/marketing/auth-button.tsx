import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function AuthButton() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	return user ? (
		<div className="flex items-center gap-3">
			<Link
				className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline"
				href="/organizations"
			>
				Dashboard
			</Link>
			<LogoutButton />
		</div>
	) : (
		<div className="flex items-center gap-2">
			<Button asChild size="sm" variant="ghost" className="text-muted-foreground">
				<Link href="/login">Sign in</Link>
			</Button>
			<Button asChild size="sm">
				<Link href="/sign-up">Sign up</Link>
			</Button>
		</div>
	);
}
