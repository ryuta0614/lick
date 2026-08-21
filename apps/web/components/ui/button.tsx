import * as React from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "default" | "outline" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  ghost: "bg-transparent hover:bg-muted",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
