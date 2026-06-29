/**
 * 스크롤 영역 컴포넌트 — Base UI 스크롤 영역 래퍼.
 * 커스텀 스크롤바 두께는 globals.css 네이티브 스크롤바와 동일하게 얇게(thumb ~6px) 맞춤.
 */
"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

// 뷰포트 + 얇은 스크롤바를 갖춘 스크롤 영역 루트를 렌더한다.
function ScrollArea({
    className,
    children,
    ...props
}: ScrollAreaPrimitive.Root.Props) {
    return (
        <ScrollAreaPrimitive.Root
            data-slot="scroll-area"
            className={cn("relative", className)}
            {...props}
        >
            <ScrollAreaPrimitive.Viewport
                data-slot="scroll-area-viewport"
                className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
            >
                {children}
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar />
            <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
    )
}

// 얇은 스크롤바(트랙 10px 폭, p-0.5 패딩으로 thumb 약 6px)를 렌더한다 — 네이티브 스크롤바와 두께 통일.
function ScrollBar({
    className,
    orientation = "vertical",
    ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
    return (
        <ScrollAreaPrimitive.Scrollbar
            data-slot="scroll-area-scrollbar"
            data-orientation={orientation}
            orientation={orientation}
            className={cn(
                "flex touch-none p-0.5 transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-vertical:h-full data-vertical:w-2.5",
                className
            )}
            {...props}
        >
            <ScrollAreaPrimitive.Thumb
                data-slot="scroll-area-thumb"
                className="relative flex-1 rounded-full bg-border"
            />
        </ScrollAreaPrimitive.Scrollbar>
    )
}

export { ScrollArea, ScrollBar }
