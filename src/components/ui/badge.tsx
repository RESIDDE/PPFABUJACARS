import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/30",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/15 text-destructive border border-destructive/30",
        outline: "border border-border text-foreground",
        pending: "badge-pending",
        in_progress: "badge-in-progress",
        completed: "badge-completed",
        delivered: "badge-delivered",
        cancelled: "badge-cancelled",
        draft: "badge-draft",
        paid: "badge-paid",
        sent: "badge-in-progress",
        overdue: "badge-overdue",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
