"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof T.List>,
  React.ComponentPropsWithoutRef<typeof T.List>
>(({ className, ...props }, ref) => (
  <T.List ref={ref} className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)} {...props} />
));
TabsList.displayName = T.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof T.Trigger>,
  React.ComponentPropsWithoutRef<typeof T.Trigger>
>(({ className, ...props }, ref) => (
  <T.Trigger ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow", className)} {...props} />
));
TabsTrigger.displayName = T.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof T.Content>,
  React.ComponentPropsWithoutRef<typeof T.Content>
>(({ className, ...props }, ref) => (
  <T.Content ref={ref} className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props} />
));
TabsContent.displayName = T.Content.displayName;
