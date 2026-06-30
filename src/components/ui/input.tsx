import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-2 text-sm text-[color:var(--foreground)] shadow-sm outline-none transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--ring)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
