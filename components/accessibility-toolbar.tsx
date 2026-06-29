/**
 * 보기 설정 툴바 — 글자 크기(3단계)·고대비 모드·다크/라이트 테마를 한 곳에서 제어하는
 * 드롭다운 아이콘 버튼 컴포넌트. 헤더 우측 및 비로그인 상태에서 노출된다.
 */
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Settings2 } from "lucide-react";
import { usePrefs, type FontScale, type UiScale } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// 보기 설정 드롭다운 버튼을 렌더한다.
export function AccessibilityToolbar({ className }: { className?: string }) {
    const fontScale = usePrefs((s) => s.fontScale);
    const setFontScale = usePrefs((s) => s.setFontScale);
    const uiScale = usePrefs((s) => s.uiScale);
    const setUiScale = usePrefs((s) => s.setUiScale);
    const contrast = usePrefs((s) => s.contrast);
    const toggleContrast = usePrefs((s) => s.toggleContrast);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const isDark = mounted && theme === "dark";

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="보기 설정 — 글자 크기·고대비·화면 밝기"
                                    className={cn("size-9", className)}
                                />
                            }
                        />
                    }
                >
                    <Settings2 className="size-5" />
                </TooltipTrigger>
                <TooltipContent>보기 설정</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    글자 크기
                </div>
                <DropdownMenuRadioGroup
                    value={fontScale}
                    onValueChange={(v) => setFontScale(v as FontScale)}
                >
                    <DropdownMenuRadioItem value="base">
                        <span className="text-sm">보통</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lg">
                        <span className="text-base">크게</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="xl">
                        <span className="text-lg">아주 크게</span>
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    화면 크기 (버튼·여백)
                </div>
                <DropdownMenuRadioGroup
                    value={uiScale}
                    onValueChange={(v) => setUiScale(v as UiScale)}
                >
                    <DropdownMenuRadioItem value="base">보통</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lg">크게</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="xl">아주 크게</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    화면
                </div>
                <DropdownMenuCheckboxItem
                    checked={contrast}
                    onCheckedChange={() => toggleContrast()}
                    closeOnClick={false}
                >
                    고대비 모드
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={isDark}
                    onCheckedChange={() => setTheme(isDark ? "light" : "dark")}
                    closeOnClick={false}
                >
                    어두운 화면
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
