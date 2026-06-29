"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessibilityController } from "@/components/accessibility-controller";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            <AccessibilityController />
            {/* Global tooltip provider so any TooltipTrigger works app-wide.
                    delay = hover dwell (ms) before a tooltip appears. */}
            <TooltipProvider delay={300}>{children}</TooltipProvider>
            <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
    );
}
