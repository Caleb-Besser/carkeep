import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--primary)] px-4 py-2.5 text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary-strong)]",
        secondary:
          "bg-[color:var(--secondary)] px-4 py-2.5 text-[color:var(--secondary-foreground)] hover:bg-[color:var(--secondary-strong)]",
        outline:
          "border border-[color:var(--border)] bg-transparent px-4 py-2.5 text-[color:var(--foreground)] hover:bg-[color:var(--muted)]",
        ghost: "px-3 py-2 text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]",
        destructive:
          "bg-[color:var(--danger)] px-4 py-2.5 text-white hover:bg-[color:var(--danger-strong)]",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
