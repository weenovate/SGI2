"use client";
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 sm:max-w-sm",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

// Toasts: usan los tokens del tema (no colores tailwind hardcoded)
// para que sigan a la paleta activa.
const toastVariants = cva(
  "pointer-events-auto group relative flex w-full items-start gap-3 overflow-hidden rounded-md border-l-4 border-y border-r p-4 pr-8 shadow-lg backdrop-blur-sm",
  {
    variants: {
      variant: {
        info: "border-l-info border-y-border border-r-border bg-info/10 text-foreground",
        success: "border-l-success border-y-border border-r-border bg-success/10 text-foreground",
        warning: "border-l-warning border-y-border border-r-border bg-warning/10 text-foreground",
        critical: "border-l-destructive border-y-border border-r-border bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitives.Root.displayName;

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 transition-opacity hover:text-foreground/80",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold leading-tight", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-xs opacity-90", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export function ToastIcon({ variant }: { variant: "info" | "success" | "warning" | "critical" }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />;
    case "critical":
      return <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />;
    default:
      return <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />;
  }
}

export { ToastProvider, ToastViewport };
