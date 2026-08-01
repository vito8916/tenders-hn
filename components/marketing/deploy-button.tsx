import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DeployButton() {
  return (
    <div className="hidden md:block">
      <Link href="/login">
        <Button className="flex items-center gap-2" size="sm">
          Get Started
        </Button>
      </Link>
    </div>
  );
}
