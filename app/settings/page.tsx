/**
 * 내 정보·설정 페이지 — 프로필 사진, 강좌 주차 보기 방식(카드/테이블), 글자 크기, 고대비·다크 모드를
 * 한 화면에서 바꾸는 전용 페이지. 기존 헤더 드롭다운 모달(ProfileDialog)을 대체한다.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, LayoutGrid, List, Square, Image } from "lucide-react";
import { toast } from "sonner";

import { useIdentity } from "@/lib/identity";
import { usePrefs, type FontScale, type UiScale, type CardStyle, type CornerRadius } from "@/lib/store";
import { updateProfile } from "@/lib/api";
import { AVATAR_CATEGORIES, avatarsByCategory, avatarSrc } from "@/lib/avatars";
import { cn } from "@/lib/utils";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// 역할 표시 레이블을 한국어로 반환한다.
function roleLabel(role: "instructor" | "student" | null): string {
    if (role === "instructor") return "강사";
    if (role === "student") return "학생";
    return "";
}

// 글자 크기 세그먼트 정의 — 페이지에서는 미리보기 글씨도 키워서 보여준다.
const FONT_SCALES: { value: FontScale; label: string; className: string }[] = [
    { value: "base", label: "보통", className: "text-base" },
    { value: "lg", label: "크게", className: "text-lg" },
    { value: "xl", label: "아주 크게", className: "text-xl" },
];

// UI 크기 세그먼트 정의 — 버튼·여백·아이콘 크기를 글자와 독립적으로 조절한다.
const UI_SCALES: { value: UiScale; label: string }[] = [
    { value: "base", label: "보통" },
    { value: "lg", label: "크게" },
    { value: "xl", label: "아주 크게" },
];

// 강좌 콘텐츠 카드 모양 정의 — 내 정보에서 네 가지 중 고른다(솔리드 타일·모노 미니멀·커버·콤팩트).
const CARD_STYLES: { value: CardStyle; label: string; desc: string; Icon: typeof LayoutGrid }[] = [
    { value: "tile", label: "솔리드 타일", desc: "색 아이콘으로 또렷하게", Icon: LayoutGrid },
    { value: "minimal", label: "모노 미니멀", desc: "색을 절제한 깔끔한 카드", Icon: Square },
    { value: "cover", label: "커버", desc: "상단 색 배너가 있는 카드", Icon: Image },
    { value: "compact", label: "콤팩트", desc: "촘촘한 한 줄 목록", Icon: List },
];

// 카드 모양 선택 버튼 안에 들어갈 작은 미리보기 도식을 그린다.
function StylePreview({ value }: { value: CardStyle }) {
    const tones = ["bg-blue-500", "bg-violet-500"];
    if (value === "compact") {
        return (
            <div className="flex w-full flex-col gap-1">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded border bg-card px-1.5 py-1">
                        <span className="size-2 shrink-0 rounded-sm bg-blue-500" />
                        <span className="h-1.5 flex-1 rounded bg-muted-foreground/20" />
                    </div>
                ))}
            </div>
        );
    }
    if (value === "cover") {
        return (
            <div className="flex w-full gap-1.5">
                {tones.map((c, i) => (
                    <div key={i} className="flex-1 overflow-hidden rounded border bg-card">
                        <div className={cn("h-3", c)} />
                        <div className="space-y-1 p-1.5">
                            <div className="h-1.5 w-3/4 rounded bg-muted-foreground/20" />
                            <div className="h-1.5 w-1/2 rounded bg-muted-foreground/15" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    if (value === "minimal") {
        return (
            <div className="flex w-full gap-1.5">
                {tones.map((c, i) => (
                    <div key={i} className="flex-1 space-y-1 rounded border bg-card p-1.5">
                        <span className={cn("block size-1.5 rounded-full", c)} />
                        <div className="h-1.5 w-3/4 rounded bg-muted-foreground/20" />
                        <div className="h-1.5 w-1/2 rounded bg-muted-foreground/15" />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="flex w-full gap-1.5">
            {tones.map((c, i) => (
                <div key={i} className="flex flex-1 gap-1.5 rounded border bg-card p-1.5">
                    <span className={cn("size-4 shrink-0 rounded", c)} />
                    <div className="flex-1 space-y-1 pt-0.5">
                        <div className="h-1.5 w-full rounded bg-muted-foreground/20" />
                        <div className="h-1.5 w-2/3 rounded bg-muted-foreground/15" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// 콘텐츠별 묶기 ON/OFF 세그먼트 정의 — 주차 안 항목을 종류별로 묶을지 여부.
const GROUP_OPTIONS: { value: boolean; label: string }[] = [
    { value: true, label: "ON" },
    { value: false, label: "OFF" },
];

// 모서리 둥글기 세그먼트 정의 — 버튼·카드 등 전역 --radius 값을 5단계로 조절한다. previewPx는 미리보기 사각형 둥글기(px).
const CORNER_RADIUS_OPTIONS: { value: CornerRadius; label: string; previewPx: number }[] = [
    { value: "none", label: "각짐", previewPx: 0 },
    { value: "sm", label: "살짝", previewPx: 4 },
    { value: "base", label: "기본", previewPx: 8 },
    { value: "lg", label: "둥글게", previewPx: 12 },
    { value: "xl", label: "많이", previewPx: 16 },
];

// 내 정보·설정 페이지 컴포넌트.
export default function SettingsPage() {
    const router = useRouter();

    // 사용자 정보
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const role = useIdentity((s) => s.role);
    const avatar = useIdentity((s) => s.avatar);
    const hydrated = useIdentity((s) => s.hydrated);
    const setProfile = useIdentity((s) => s.setProfile);
    const clear = useIdentity((s) => s.clear);

    // 보기 설정
    const fontScale = usePrefs((s) => s.fontScale);
    const setFontScale = usePrefs((s) => s.setFontScale);
    const uiScale = usePrefs((s) => s.uiScale);
    const setUiScale = usePrefs((s) => s.setUiScale);
    const contrast = usePrefs((s) => s.contrast);
    const toggleContrast = usePrefs((s) => s.toggleContrast);
    const cardStyle = usePrefs((s) => s.cardStyle);
    const setCardStyle = usePrefs((s) => s.setCardStyle);
    const groupByContent = usePrefs((s) => s.groupByContent);
    const setGroupByContent = usePrefs((s) => s.setGroupByContent);
    const cornerRadius = usePrefs((s) => s.cornerRadius);
    const setCornerRadius = usePrefs((s) => s.setCornerRadius);

    // 테마 — SSR 불일치 방지를 위한 mounted 가드
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const isDark = mounted && theme === "dark";

    // 로그인하지 않은 상태로 설정 페이지에 직접 진입하면 로그인으로 보낸다.
    useEffect(() => {
        if (hydrated && !userId) router.replace("/login");
    }, [hydrated, userId, router]);

    // 아바타 저장 중 비활성 상태
    const [savingAvatar, setSavingAvatar] = useState(false);

    // 아바타 선택 핸들러
    async function handleSelectAvatar(key: string) {
        if (!userId || savingAvatar) return;
        setSavingAvatar(true);
        try {
            await updateProfile({ userId, avatar: key });
            setProfile({ avatar: key });
            toast.success("프로필 사진이 변경되었어요.");
        } catch {
            toast.error("프로필 사진 변경에 실패했습니다.");
        } finally {
            setSavingAvatar(false);
        }
    }

    // 로그아웃 핸들러
    function handleLogout() {
        clear();
        router.push("/login");
        toast.success("로그아웃 되었습니다.");
    }

    // 이름 첫 글자 (Avatar 폴백)
    const fallbackChar = nickname ? nickname.charAt(0) : (userId ? userId.charAt(0) : "?");

    return (
        <>
            <SiteHeader />

            <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
                {/* 페이지 헤더 */}
                <div className="mb-8 flex flex-col gap-1">
                    <span className="eyebrow">내 정보</span>
                    <h1 className="text-3xl font-bold">내 정보 · 설정</h1>
                </div>

                {!hydrated ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground">
                        불러오는 중…
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        <Tabs defaultValue="profile" className="gap-6">
                        <TabsList className="w-full">
                            <TabsTrigger value="profile" className="flex-1">내 정보</TabsTrigger>
                            <TabsTrigger value="view" className="flex-1">설정</TabsTrigger>
                        </TabsList>

                        {/* ── 내 정보 탭: 사용자 정보 · 프로필 사진 ── */}
                        <TabsContent value="profile" className="flex flex-col gap-8">

                        {/* ── 1. 사용자 정보 ── */}
                        <section className="flex items-center gap-4 rounded-2xl bg-muted/40 p-5">
                            <Avatar size="lg" className="size-16 text-2xl">
                                {avatarSrc(avatar) && (
                                    <AvatarImage
                                        src={avatarSrc(avatar)!}
                                        alt={nickname ?? userId ?? "프로필"}
                                    />
                                )}
                                <AvatarFallback className="text-xl font-bold">
                                    {fallbackChar}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="truncate text-lg font-bold">
                                    {nickname ?? userId ?? "사용자"}
                                </span>
                                {role && (
                                    <Badge variant="secondary" className="w-fit px-2.5 py-0.5 text-sm">
                                        {roleLabel(role)}
                                    </Badge>
                                )}
                                {userId && (
                                    <span className="mono truncate text-xs text-muted-foreground">
                                        @{userId}
                                    </span>
                                )}
                            </div>
                        </section>

                        {/* ── 2. 프로필 사진 선택 ── 동물·꽃·자연 카테고리로 묶어서 보여준다 */}
                        <section className="flex flex-col gap-5">
                            <h2 className="text-base font-semibold text-foreground">프로필 사진</h2>
                            {AVATAR_CATEGORIES.map((cat) => (
                                <div key={cat.key} className="flex flex-col gap-2.5">
                                    <span className="text-sm font-medium text-muted-foreground">{cat.label}</span>
                                    <div className="grid grid-cols-4 gap-3">
                                        {avatarsByCategory(cat.key).map((a) => {
                                            const isSelected = avatar === a.key;
                                            return (
                                                <button
                                                    key={a.key}
                                                    type="button"
                                                    disabled={savingAvatar}
                                                    onClick={() => handleSelectAvatar(a.key)}
                                                    aria-label={`${a.label} 선택${isSelected ? " (현재 선택)" : ""}`}
                                                    aria-pressed={isSelected}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all",
                                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                        "disabled:cursor-not-allowed disabled:opacity-50",
                                                        isSelected
                                                            ? "border-primary bg-primary/10"
                                                            : "border-transparent bg-muted/40 hover:bg-muted/80",
                                                    )}
                                                >
                                                    <img
                                                        src={a.src}
                                                        alt={a.label}
                                                        className="size-14 rounded-full object-cover"
                                                        draggable={false}
                                                    />
                                                    <span className="text-xs leading-none text-muted-foreground">
                                                        {a.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </section>

                        </TabsContent>

                        {/* ── 설정 탭: 보기 설정 ── */}
                        <TabsContent value="view" className="flex flex-col gap-8">
                        <section className="flex flex-col gap-5">

                            {/* 강좌 콘텐츠 카드 모양 — 내 정보에서 네 가지 중 선택 */}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-muted-foreground">강좌 콘텐츠 카드 모양</span>
                                <div className="grid grid-cols-2 gap-3">
                                    {CARD_STYLES.map(({ value, label, desc, Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCardStyle(value)}
                                            aria-pressed={cardStyle === value}
                                            className={cn(
                                                "flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                cardStyle === value
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-muted/40 hover:bg-muted/80",
                                            )}
                                        >
                                            <StylePreview value={value} />
                                            <div className="flex items-center gap-1.5">
                                                <Icon className="size-4 text-muted-foreground" />
                                                <span className="text-base font-semibold">{label}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 콘텐츠별 묶기 ON/OFF — 주차 안 항목을 공지·강의·게시물·시험·연습 종류별로 묶을지 여부 */}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-muted-foreground">콘텐츠별 묶기</span>
                                <div className="flex gap-2">
                                    {GROUP_OPTIONS.map(({ value, label }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setGroupByContent(value)}
                                            aria-pressed={groupByContent === value}
                                            className={cn(
                                                "flex-1 rounded-lg border-2 px-1 py-3 text-base font-bold transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                groupByContent === value
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-muted/40 text-foreground hover:bg-muted/80",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    켜면 주차 안 항목을 공지·강의·게시물·시험·연습 종류별로 묶어서 보여줍니다.
                                </span>
                            </div>

                            {/* 글자 크기 세그먼트 */}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-muted-foreground">글자 크기</span>
                                <div className="flex gap-2">
                                    {FONT_SCALES.map(({ value, label, className }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFontScale(value)}
                                            aria-pressed={fontScale === value}
                                            className={cn(
                                                "flex-1 rounded-lg border-2 px-1 py-3 font-medium transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                className,
                                                fontScale === value
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-muted/40 text-foreground hover:bg-muted/80",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* UI 크기 세그먼트 — 버튼·여백·아이콘 크기(글자와 독립) */}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-muted-foreground">화면 크기 (버튼·여백·아이콘)</span>
                                <div className="flex gap-2">
                                    {UI_SCALES.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setUiScale(value)}
                                            aria-pressed={uiScale === value}
                                            className={cn(
                                                "flex-1 rounded-lg border-2 px-1 py-3 text-base font-medium transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                uiScale === value
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-muted/40 text-foreground hover:bg-muted/80",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 모서리 둥글기 세그먼트 — 버튼·카드 등 전역 모서리 둥글기(--radius)를 5단계로 조절한다 */}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-muted-foreground">버튼 · 카드 모서리 둥글기</span>
                                <div className="grid grid-cols-5 gap-2">
                                    {CORNER_RADIUS_OPTIONS.map(({ value, label, previewPx }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCornerRadius(value)}
                                            aria-pressed={cornerRadius === value}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 rounded-lg border-2 px-1 py-2.5 transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                cornerRadius === value
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-muted/40 hover:bg-muted/80",
                                            )}
                                        >
                                            <span
                                                className="size-6 border-2 border-foreground/60"
                                                style={{ borderRadius: previewPx }}
                                            />
                                            <span className="text-xs font-medium">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 고대비 모드 */}
                            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-medium">고대비 모드</span>
                                    <span className="text-sm text-muted-foreground">
                                        텍스트와 버튼의 대비를 높입니다
                                    </span>
                                </div>
                                <Switch
                                    checked={contrast}
                                    onCheckedChange={() => toggleContrast()}
                                    aria-label="고대비 모드 켜기/끄기"
                                />
                            </div>

                            {/* 어두운 화면 — mounted 전에는 렌더 생략(SSR 불일치 방지) */}
                            {mounted && (
                                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-base font-medium">어두운 화면</span>
                                        <span className="text-sm text-muted-foreground">
                                            다크 모드로 전환합니다
                                        </span>
                                    </div>
                                    <Switch
                                        checked={isDark}
                                        onCheckedChange={() => setTheme(isDark ? "light" : "dark")}
                                        aria-label="다크 모드 켜기/끄기"
                                    />
                                </div>
                            )}
                        </section>
                        </TabsContent>
                        </Tabs>

                        {/* ── 로그아웃 — 탭과 무관하게 항상 노출 ── */}
                        <Separator />
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full gap-2 text-base text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleLogout}
                        >
                            <LogOut className="size-5" />
                            로그아웃
                        </Button>
                    </div>
                )}
            </main>
        </>
    );
}
