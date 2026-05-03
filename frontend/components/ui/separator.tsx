"use client";
import * as React from "react";
import * as S from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  React.ElementRef<typeof S.Root>,
  React.ComponentPropsWithoutRef<typeof S.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <S.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
    {...props}
  />
));
Separator.displayName = S.Root.displayName;
