/**
 * 사이트 공통 상단바(Topbar) — 주요 페이지 상단에 고정되며, 스크롤 전에는 구분선이 없다가
 * 스크롤이 시작되면 배경·구분선·그림자가 부드럽게 나타나는 모던 헤더.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, ChevronDown, UserCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useIdentity } from "@/lib/identity";
import { avatarSrc } from "@/lib/avatars";
import { cn } from "@/lib/utils";

// 페이지가 임계값 이상 세로 스크롤됐는지 추적한다(상단바 구분선 표시 여부 판단용).
function useScrolled(threshold = 6) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > threshold);
        onScroll(); // 새로고침 시 이미 스크롤된 상태를 즉시 반영.
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [threshold]);

    return scrolled;
}

// 사이트 공통 상단바를 렌더링한다.
export function SiteHeader() {
    const router = useRouter();
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const role = useIdentity((s) => s.role);
    const avatar = useIdentity((s) => s.avatar);
    const hydrated = useIdentity((s) => s.hydrated);
    const clear = useIdentity((s) => s.clear);

    const scrolled = useScrolled();

    function handleLogout() {
        clear();
        toast.success("로그아웃되었습니다.");
        router.push("/login");
    }

    const firstChar = nickname ? nickname.charAt(0) : "?";
    const roleLabel = role === "instructor" ? "강사" : "학생";
    const roleBadgeVariant = role === "instructor" ? "default" : "secondary";
    const src = avatarSrc(avatar);

    return (
        <header
            className={cn(
                // 항상 border-b 폭을 유지하되 색만 바꿔 스크롤 시 레이아웃이 밀리지 않게 한다.
                "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
                scrolled
                    ? "border-border bg-background/80 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/65"
                    : "border-transparent bg-background/0 shadow-none backdrop-blur-0",
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
                <BrandLogo />
                <div className="ml-auto flex items-center gap-3">
                    {hydrated && nickname ? (
                        <>
                            {/* 보기 설정은 '내 정보 · 설정' 전용 페이지(/settings)로 이동 */}
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant="ghost"
                                            className="flex items-center gap-2 h-9 px-2 cursor-pointer"
                                            aria-label="내 계정 메뉴"
                                        />
                                    }
                                >
                                    <Avatar size="sm">
                                        {src && <AvatarImage src={src} alt="" />}
                                        <AvatarFallback>{firstChar}</AvatarFallback>
                                    </Avatar>
                                    <span className="hidden text-sm font-medium sm:inline">
                                        {nickname}님
                                    </span>
                                    <ChevronDown className="size-3.5 text-muted-foreground" />
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-56">
                                    {/* 요약 정보 */}
                                    <div className="flex items-center gap-2.5 px-2 py-2">
                                        <Avatar size="default">
                                            {src && <AvatarImage src={src} alt="" />}
                                            <AvatarFallback>{firstChar}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate text-sm font-semibold">
                                                    {nickname}
                                                </span>
                                                <Badge variant={roleBadgeVariant} className="text-[10px]">
                                                    {roleLabel}
                                                </Badge>
                                            </div>
                                            <span className="mono truncate text-xs text-muted-foreground">
                                                @{userId}
                                            </span>
                                        </div>
                                    </div>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                                        <UserCircle className="size-4" />
                                        내 정보 · 설정
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => router.push("/programs")}>
                                        <BookOpen className="size-4" />
                                        내 강좌
                                    </DropdownMenuItem>

                                    {/* AI 스튜디오(사용량·사용 로그) 바로가기 */}
                                    <DropdownMenuItem onClick={() => router.push("/studio")}>
                                        <BarChart3 className="size-4" />
                                        AI 스튜디오 · 사용량
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                                        <LogOut className="size-4" />
                                        로그아웃
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <>
                            {/* 비로그인 상태에서는 빠른 보기 설정 유지 */}
                            <AccessibilityToolbar />
                            <Button render={<Link href="/login" />} size="sm">
                                시작하기
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
