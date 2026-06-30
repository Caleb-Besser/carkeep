import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--ring)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
