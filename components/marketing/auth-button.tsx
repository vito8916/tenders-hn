import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const pressable = "transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]";

export async function AuthButton() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	return user ? (
		<Button asChild size="sm" className={pressable}>
			<Link href="/organizations">Ir a mi panel</Link>
		</Button>
	) : (
		<div className="flex items-center gap-1">
			<Button asChild size="sm" variant="ghost" className={`text-muted-foreground ${pressable}`}>
				<Link href="/login">Iniciar sesión</Link>
			</Button>
			<Button asChild size="sm" className={pressable}>
				<Link href="/sign-up">Solicitar acceso</Link>
			</Button>
		</div>
	);
}
