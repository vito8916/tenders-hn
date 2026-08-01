import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectDetailsNotFound() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <div>
                <h1 className="text-2xl font-semibold">Project not found</h1>
                <p className="text-sm text-muted-foreground">
                    This project might have been removed or the slug is incorrect.
                </p>
            </div>
            <Button asChild variant="outline">
                <Link href="/organizations">Back to organizations</Link>
            </Button>
        </div>
    );
}
