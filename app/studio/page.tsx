/**
 * AI 스튜디오 · 내 사용량 대시보드 — 로그인한 "본인"이 강의 AI 블럭에서 쓴 OpenRouter
 * 사용 요금을 크레딧으로 집계해 보여 준다(남의 사용량은 보지 못한다). 날짜 구간 필터,
 * 다양한 차트(크레딧 추이·종류별 비중·많이 쓴 모델·종류별 횟수), 그리고 기록을 클릭하면
 * 그때 만든 결과물을 다시 열어 볼 수 있는 상세 다이얼로그를 제공한다.
 */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ko } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
    BarChart3,
    Coins,
    TrendingUp,
    RefreshCw,
    FileText,
    ImageIcon,
    Video,
    Music,
    CalendarIcon,
    Eye,
    LineChart,
    PieChart,
    Layers,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CreditTrendChart,
    ModelUsageChart,
    CategoryDonutChart,
    CategoryCountBars,
} from "@/components/studio/usage-charts";
import {
    UsageRecordDialog,
    type UsageRecordDetail,
} from "@/components/studio/usage-record-dialog";

import { getMyUsage, getUsageRecord } from "@/lib/api";
import { formatCredits, formatKrw, formatUsd, creditsToKrw } from "@/lib/credits";
import { useIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import type { StudioCategory, UsageRecord } from "@/lib/types";

/** 사용량 화면에서 다루는 4개 카테고리의 한국어 라벨·아이콘·텍스트색·차트색. */
// 생성 기록 표 한 페이지에 보여 줄 행 수.
const PAGE_SIZE = 20;

const CATEGORIES: {
    key: StudioCategory;
    label: string;
    Icon: React.ElementType;
    text: string;
    color: string;
}[] = [
    { key: "text", label: "텍스트", Icon: FileText, text: "text-blue-500", color: "#3b82f6" },
    { key: "image", label: "이미지", Icon: ImageIcon, text: "text-violet-500", color: "#8b5cf6" },
    { key: "video", label: "동영상", Icon: Video, text: "text-rose-500", color: "#f43f5e" },
    { key: "audio", label: "오디오", Icon: Music, text: "text-amber-500", color: "#f59e0b" },
];

/** 카테고리 키로 라벨·아이콘·색 메타를 찾는다(없으면 텍스트로 폴백). */
function categoryMeta(cat: StudioCategory) {
    return CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0];
}

/** 밀리초 타임스탬프를 한국어 상대 시간 또는 절대 시간 문자열로 반환한다. */
function formatWhen(ms: number): string {
    const now = Date.now();
    const diff = now - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return new Date(ms).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** 자정(00:00:00.000)으로 내린 Date를 반환한다. */
function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** 하루의 끝(23:59:59.999)으로 올린 Date를 반환한다. */
function endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

/** 오늘 자정에서 n-1일 전 자정 Date를 반환한다(최근 n일 구간 시작용). */
function daysAgoStart(n: number): Date {
    const x = startOfDay(new Date());
    x.setDate(x.getDate() - (n - 1));
    return x;
}

/** 밀리초를 "YYYY-MM-DD" 로컬 날짜 키로 바꾼다(일자 집계용). */
function dayKey(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" 키를 "M/D" 짧은 라벨로 바꾼다(차트 x축용). */
function dayLabel(key: string): string {
    const [, m, d] = key.split("-");
    return `${Number(m)}/${Number(d)}`;
}

/** Date를 "M.D" 짧은 표시로 바꾼다(구간 버튼 라벨용). */
function shortDate(d: Date): string {
    return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** KPI 카드 한 개를 렌더링한다. */
function KpiCard({
    label,
    value,
    sub,
    icon: Icon,
    hero,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    hero?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-2xl border p-5",
                hero ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30",
            )}
        >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className={cn("size-4", hero ? "text-primary" : "")} />
                {label}
            </div>
            <p className={cn("text-3xl font-bold", hero ? "text-primary" : "text-foreground")}>
                {value}
            </p>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
    );
}

/** 제목 + 아이콘이 달린 차트 카드 래퍼. */
function ChartCard({
    title,
    icon: Icon,
    children,
    className,
}: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-5", className)}>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-muted-foreground" />
                {title}
            </h3>
            {children}
        </div>
    );
}

/** 스켈레톤 로딩 화면을 렌더링한다. */
function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
        </div>
    );
}

/** AI 스튜디오(내 사용량 대시보드) 페이지 컴포넌트. */
export default function StudioPage() {
    const userId = useIdentity((s) => s.userId);
    const hydrated = useIdentity((s) => s.hydrated);

    const [records, setRecords] = useState<UsageRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // 날짜 구간 필터(미설정이면 전체 기간).
    const [range, setRange] = useState<DateRange | undefined>(undefined);
    const [calOpen, setCalOpen] = useState(false);

    // 생성 기록 표 필터 — 종류(전체/카테고리)와 모델(전체/모델키).
    const [catFilter, setCatFilter] = useState<StudioCategory | "all">("all");
    const [modelFilter, setModelFilter] = useState<string>("all");

    // 생성 기록 표 페이지네이션(1-base).
    const [page, setPage] = useState(1);

    // 기록 상세 다이얼로그 상태.
    const [recOpen, setRecOpen] = useState(false);
    const [recDetail, setRecDetail] = useState<UsageRecordDetail | null>(null);
    const [recLoading, setRecLoading] = useState(false);

    // 내 사용 기록을 서버에서 가져와 상태를 갱신한다(본인 것만).
    const fetchUsage = useCallback(async (isRefresh = false) => {
        if (!userId) {
            setRecords([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const data = await getMyUsage(userId);
            setRecords(data.records);
        } catch (e) {
            setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        if (hydrated) {
            fetchUsage();
        }
    }, [hydrated, fetchUsage]);

    // 새로고침 버튼 클릭 핸들러.
    function handleRefresh() {
        fetchUsage(true);
    }

    // 최근 n일 구간 프리셋을 적용한다(전체는 undefined).
    function applyPreset(days: number | null) {
        if (days == null) {
            setRange(undefined);
        } else {
            setRange({ from: daysAgoStart(days), to: startOfDay(new Date()) });
        }
        setCalOpen(false);
    }

    // 한 기록을 클릭하면 메타를 즉시 띄우고 결과물 본문은 비동기로 불러온다.
    async function openRecord(rec: UsageRecord) {
        if (!userId) return;
        const meta: UsageRecordDetail = {
            id: rec.id,
            userName: rec.userName,
            category: rec.category,
            kind: rec.kind,
            modelLabel: rec.modelLabel,
            prompt: rec.prompt,
            output: null,
            credits: rec.credits,
            costUsd: rec.costUsd,
            genMs: rec.genMs,
            createdAt: rec.createdAt,
        };
        setRecDetail(meta);
        setRecOpen(true);
        if (!rec.hasOutput) return; // 저장된 결과물이 없으면 그대로 안내만.
        setRecLoading(true);
        try {
            const full = await getUsageRecord(rec.id, userId);
            setRecDetail({ ...meta, output: full.output ?? null, kind: full.kind });
        } catch {
            // 본문 조회 실패 시 메타만 유지(다이얼로그가 "결과물 없음"으로 표시).
        } finally {
            setRecLoading(false);
        }
    }

    // 날짜 구간으로 거른 내 기록과 모든 파생 집계(차트·KPI)를 계산한다.
    const view = useMemo(() => {
        const fromMs = range?.from ? startOfDay(range.from).getTime() : null;
        const toMs = range?.from ? endOfDay(range.to ?? range.from).getTime() : null;
        const filtered =
            fromMs != null && toMs != null
                ? records.filter((r) => r.createdAt >= fromMs && r.createdAt <= toMs)
                : records;

        // KPI 총계.
        const totals = filtered.reduce(
            (acc, r) => {
                acc.credits += r.credits;
                acc.usd += r.costUsd;
                acc.count += 1;
                return acc;
            },
            { credits: 0, usd: 0, count: 0 },
        );

        // 일자별 크레딧 추이(데이터 있는 날만, 오름차순).
        const dayMap = new Map<string, { credits: number; count: number }>();
        for (const r of filtered) {
            const k = dayKey(r.createdAt);
            const e = dayMap.get(k) ?? { credits: 0, count: 0 };
            e.credits += r.credits;
            e.count += 1;
            dayMap.set(k, e);
        }
        const trend = [...dayMap.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([k, v]) => ({ label: dayLabel(k), credits: v.credits, count: v.count }));

        // 많이 사용한 모델 Top 6(횟수 내림차순).
        const modelMap = new Map<string, { credits: number; count: number }>();
        for (const r of filtered) {
            const key = r.modelLabel || r.model || "(알 수 없음)";
            const e = modelMap.get(key) ?? { credits: 0, count: 0 };
            e.credits += r.credits;
            e.count += 1;
            modelMap.set(key, e);
        }
        const models = [...modelMap.entries()]
            .map(([label, v]) => ({ label, credits: v.credits, count: v.count }))
            .sort((a, b) => b.count - a.count || b.credits - a.credits)
            .slice(0, 6);

        // 종류별 크레딧·횟수 집계.
        const catAgg = CATEGORIES.map((c) => {
            let credits = 0;
            let count = 0;
            for (const r of filtered) {
                if (r.category === c.key) {
                    credits += r.credits;
                    count += 1;
                }
            }
            return { key: c.key, label: c.label, color: c.color, credits, count };
        });
        const donutData = catAgg.filter((c) => c.count > 0);
        const countData = catAgg.filter((c) => c.count > 0);

        return { filtered, totals, trend, models, donutData, countData };
    }, [records, range]);

    // 기간 안의 기록에서 종류별 개수(필터 칩에 표시).
    const catCounts = useMemo(() => {
        const m = new Map<StudioCategory, number>();
        for (const r of view.filtered) m.set(r.category, (m.get(r.category) ?? 0) + 1);
        return m;
    }, [view.filtered]);

    // 기간 안의 기록에서 쓰인 모델 목록(많이 쓴 순). 모델 셀렉트에 표시.
    // 차트와 동일하게 표시 라벨(modelLabel) 기준으로 묶는다(같은 라벨이면 한 항목).
    const modelOptions = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of view.filtered) {
            const key = r.modelLabel || r.model || "(알 수 없음)";
            m.set(key, (m.get(key) ?? 0) + 1);
        }
        return [...m.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }, [view.filtered]);

    // 종류·모델 필터까지 적용한 표 대상 기록(모델은 표시 라벨 기준으로 매칭).
    const tableFiltered = useMemo(
        () =>
            view.filtered.filter(
                (r) =>
                    (catFilter === "all" || r.category === catFilter) &&
                    (modelFilter === "all" || (r.modelLabel || r.model || "(알 수 없음)") === modelFilter),
            ),
        [view.filtered, catFilter, modelFilter],
    );

    // 현재 페이지에 보여 줄 기록(최신순)과 전체 페이지 수.
    const totalRecords = tableFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
    const pageRows = useMemo(
        () => tableFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [tableFiltered, page],
    );

    // 기간 필터를 바꾸면 종류·모델 필터와 페이지를 모두 초기화한다(새 기간 = 새 시작).
    useEffect(() => {
        setCatFilter("all");
        setModelFilter("all");
        setPage(1);
    }, [range]);

    // 종류·모델 필터를 바꾸면 항상 첫 페이지부터 다시 본다.
    useEffect(() => {
        setPage(1);
    }, [catFilter, modelFilter]);

    // 기록 재로드 등으로 페이지 수가 줄면 현재 페이지를 범위 안으로 되돌린다.
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // 구간 버튼에 표시할 라벨.
    const rangeLabel = range?.from
        ? `${shortDate(range.from)} ~ ${shortDate(range.to ?? range.from)}`
        : "전체 기간";

    const signedOut = hydrated && !userId;

    return (
        <>
            <SiteHeader />

            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
                {/* 페이지 헤더 */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="size-6 text-primary" />
                            <h1 className="text-2xl font-bold">AI 스튜디오 · 내 사용량</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            내가 강의의 AI 블럭에서 쓴 OpenRouter 모델 사용 요금을 크레딧(1크레딧=0.1원)으로 집계합니다.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing || loading || !userId}
                        className="shrink-0 gap-2"
                    >
                        <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
                        새로고침
                    </Button>
                </div>

                {/* 로그인 안내 */}
                {signedOut ? (
                    <div className="rounded-2xl border border-dashed p-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            로그인하면 내 AI 사용량과 결과물을 볼 수 있어요.
                        </p>
                    </div>
                ) : loading ? (
                    <LoadingSkeleton />
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
                        <p className="text-base font-medium text-destructive">{error}</p>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>
                            다시 시도
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {/* ── 날짜 구간 필터 ── */}
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                                variant={!range ? "default" : "outline"}
                                size="sm"
                                onClick={() => applyPreset(null)}
                            >
                                전체
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => applyPreset(7)}>
                                7일
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => applyPreset(30)}>
                                30일
                            </Button>
                            <Popover open={calOpen} onOpenChange={setCalOpen}>
                                <PopoverTrigger
                                    render={
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn("gap-2", !range && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="size-4" />
                                            {rangeLabel}
                                        </Button>
                                    }
                                />
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="range"
                                        locale={ko}
                                        selected={range}
                                        defaultMonth={range?.from}
                                        onSelect={setRange}
                                        numberOfMonths={1}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 border-t p-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setRange(undefined);
                                                setCalOpen(false);
                                            }}
                                        >
                                            초기화
                                        </Button>
                                        <Button size="sm" onClick={() => setCalOpen(false)}>
                                            적용
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* ── 1. KPI 카드 ── */}
                        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <KpiCard
                                label="내 사용 크레딧"
                                value={formatCredits(view.totals.credits)}
                                sub={formatKrw(creditsToKrw(view.totals.credits))}
                                icon={Coins}
                                hero
                            />
                            <KpiCard
                                label="생성 횟수"
                                value={`${view.totals.count.toLocaleString("ko-KR")}회`}
                                icon={TrendingUp}
                            />
                            <KpiCard
                                label="USD 비용"
                                value={formatUsd(view.totals.usd)}
                                icon={BarChart3}
                            />
                        </section>

                        {/* ── 2. 차트 그리드 ── */}
                        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <ChartCard title="크레딧 사용 추이 (일자별)" icon={LineChart} className="lg:col-span-2">
                                <CreditTrendChart data={view.trend} />
                            </ChartCard>
                            <ChartCard title="종류별 크레딧 비중" icon={PieChart}>
                                <CategoryDonutChart data={view.donutData} />
                            </ChartCard>
                            <ChartCard title="많이 사용한 모델 Top 6" icon={BarChart3}>
                                <ModelUsageChart data={view.models} />
                            </ChartCard>
                            <ChartCard title="종류별 생성 횟수" icon={Layers} className="lg:col-span-2">
                                <CategoryCountBars data={view.countData} />
                            </ChartCard>
                        </section>

                        {/* ── 3. 내 생성 기록(클릭하면 결과물) ── */}
                        <section className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">내 생성 기록</h2>
                                <span className="text-xs text-muted-foreground">
                                    기록을 클릭하면 그때 만든 결과물을 볼 수 있어요
                                </span>
                            </div>

                            {/* 종류 칩 + 모델 셀렉트 필터 */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCatFilter("all")}
                                        className={cn(
                                            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                            catFilter === "all"
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:bg-muted",
                                        )}
                                    >
                                        전체 ({view.filtered.length})
                                    </button>
                                    {CATEGORIES.map((c) => {
                                        const count = catCounts.get(c.key) ?? 0;
                                        const active = catFilter === c.key;
                                        const empty = count === 0 && !active;
                                        return (
                                            <button
                                                key={c.key}
                                                type="button"
                                                onClick={() => setCatFilter(c.key)}
                                                disabled={empty}
                                                className={cn(
                                                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                                    active
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : empty
                                                            ? "border-border text-muted-foreground/40 cursor-not-allowed"
                                                            : "border-border text-muted-foreground hover:bg-muted",
                                                )}
                                            >
                                                <c.Icon className="size-3.5" />
                                                {c.label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                                <Select value={modelFilter} onValueChange={(v) => setModelFilter(v ?? "all")}>
                                    <SelectTrigger className="h-9 w-[220px] text-xs">
                                        <SelectValue placeholder="모든 모델" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">모든 모델 ({view.filtered.length})</SelectItem>
                                        {modelOptions.map((o) => (
                                            <SelectItem key={o.label} value={o.label}>
                                                {o.label} ({o.count})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {totalRecords === 0 ? (
                                <div className="rounded-2xl border border-dashed p-10 text-center">
                                    {view.filtered.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            선택한 기간에 생성 기록이 없습니다. 강의의 AI 블럭에서 생성하면 여기에 사용 로그가 쌓입니다.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <p className="text-sm text-muted-foreground">
                                                선택한 필터에 맞는 기록이 없습니다.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setCatFilter("all");
                                                    setModelFilter("all");
                                                }}
                                            >
                                                필터 초기화
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                                                <th className="px-4 py-3 font-medium">시간</th>
                                                <th className="px-4 py-3 font-medium">종류</th>
                                                <th className="px-4 py-3 font-medium">모델</th>
                                                <th className="px-4 py-3 font-medium">프롬프트</th>
                                                <th className="px-4 py-3 text-right font-medium">크레딧</th>
                                                <th className="px-4 py-3 text-center font-medium">결과물</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((rec, idx) => {
                                                const meta = categoryMeta(rec.category);
                                                const clickable = rec.hasOutput;
                                                return (
                                                    <tr
                                                        key={rec.id}
                                                        onClick={clickable ? () => openRecord(rec) : undefined}
                                                        className={cn(
                                                            "border-b border-border last:border-0 transition-colors",
                                                            idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                                                            clickable && "cursor-pointer hover:bg-primary/10",
                                                        )}
                                                    >
                                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                                                            {formatWhen(rec.createdAt)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn("flex items-center gap-1 text-xs font-medium", meta.text)}>
                                                                <meta.Icon className="size-3.5" />
                                                                {meta.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">{rec.modelLabel}</td>
                                                        <td className="max-w-[260px] px-4 py-3 text-xs text-muted-foreground">
                                                            <span className="block truncate" title={rec.prompt}>
                                                                {rec.prompt.length > 48 ? rec.prompt.slice(0, 48) + "…" : rec.prompt}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="font-semibold text-primary">{formatCredits(rec.credits)}</span>
                                                            <span className="ml-0.5 text-[10px] text-muted-foreground">크레딧</span>
                                                            <br />
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {formatKrw(creditsToKrw(rec.credits))}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {clickable ? (
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                                                                    <Eye className="size-3.5" />
                                                                    보기
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                                        <span className="text-xs text-muted-foreground">
                                            전체 {totalRecords}건 중 {(page - 1) * PAGE_SIZE + 1}–
                                            {Math.min(page * PAGE_SIZE, totalRecords)}건
                                        </span>
                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                    disabled={page <= 1}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ChevronLeft className="size-3.5" />
                                                    이전
                                                </button>
                                                <span className="text-xs tabular-nums text-muted-foreground">
                                                    {page} / {totalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={page >= totalPages}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    다음
                                                    <ChevronRight className="size-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>

            {/* 기록 상세 — 결과물 다시 보기 */}
            <UsageRecordDialog
                open={recOpen}
                onOpenChange={setRecOpen}
                record={recDetail}
                loading={recLoading}
            />
        </>
    );
}
