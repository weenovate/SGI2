import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pills semánticas: usan los tokens del tema con un fondo "/15"
// (tinte suave) y el texto en el color del estado, salvo `default`
// (botón sólido) y `outline` (transparente).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30",
        outline: "border-border bg-background/40 text-foreground",
        success: "border-transparent bg-success/15 text-success ring-1 ring-inset ring-success/30",
        warning: "border-transparent bg-warning/20 text-warning ring-1 ring-inset ring-warning/40",
        info: "border-transparent bg-info/15 text-info ring-1 ring-inset ring-info/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
