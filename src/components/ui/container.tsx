import * as React from "react";
import { cn } from "@/lib/cn";

/** Page-width wrapper: 16px gutters on phones, centred 1200px column on desktop. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
