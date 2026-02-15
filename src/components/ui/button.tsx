import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg sm:rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-target-sm",
  {
    variants: {
      variant: {
        default: "gradient-primary text-primary-foreground shadow-lg hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg active:scale-[0.98]",
        outline: "border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 backdrop-blur-sm active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground active:bg-accent/20",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-md hover:bg-success/90 hover:shadow-lg active:scale-[0.98]",
        warning: "bg-warning text-warning-foreground shadow-md hover:bg-warning/90 hover:shadow-lg active:scale-[0.98]",
        hero: "gradient-primary text-primary-foreground shadow-xl hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
        glass: "bg-white/10 backdrop-blur-sm border-2 border-white/30 text-foreground hover:bg-white/20 hover:border-white/50 active:scale-[0.98]",
        splash: "bg-white text-primary shadow-xl hover:bg-white/90 font-semibold hover:scale-[1.02] active:scale-[0.98]",
        "splash-outline": "border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm font-semibold active:scale-[0.98]",
      },
      size: {
        default: "h-10 sm:h-11 px-4 sm:px-5 py-2 sm:py-2.5",
        sm: "h-8 sm:h-9 rounded-lg px-3 sm:px-3.5 text-xs",
        lg: "h-11 sm:h-12 rounded-xl px-6 sm:px-8 text-sm sm:text-base",
        xl: "h-12 sm:h-14 rounded-xl px-8 sm:px-10 text-base sm:text-lg",
        icon: "h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl",
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
