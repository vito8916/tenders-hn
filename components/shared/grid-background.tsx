import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  variant?: "dots" | "lines";
}

export function GridBackground({
  className,
  variant = "lines",
}: GridBackgroundProps) {
  if (variant === "dots") {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          "[background-image:radial-gradient(circle,var(--grid-color)_1px,transparent_1px)]",
          "[background-size:24px_24px]",
          "[mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]",
          className
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        "[background-image:linear-gradient(var(--grid-color)_1px,transparent_1px),linear-gradient(90deg,var(--grid-color)_1px,transparent_1px)]",
        "[background-size:64px_64px]",
        "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]",
        className
      )}
    />
  );
}
