/**
 * 스튜디오 사용량 차트 모음 — 크레딧 추이(세로 막대), 모델별 사용량(가로 막대),
 * 종류별 크레딧 비중(도넛), 종류별 생성 횟수(가로 막대)를 순수 SVG/HTML로 렌더한다.
 * 외부 차트 라이브러리 없이 그리며, 데이터 패치나 상태 없이 순수 표시 전용이다.
 */
"use client";

import { cn } from "@/lib/utils";

/** 차트 공통 색상 팔레트. */
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#a855f7"];

/** 데이터가 없을 때 표시하는 안내 플레이스홀더를 반환한다. */
function EmptyPlaceholder({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center justify-center py-10 text-sm text-muted-foreground", className)}>
            표시할 데이터가 없습니다
        </div>
    );
}

/* ─────────────────────────────────────────────
   1) CreditTrendChart — 크레딧 사용 추이 (세로 막대)
───────────────────────────────────────────── */

/** CreditTrendChart에 전달하는 데이터 항목 타입. */
export type CreditTrendDatum = { label: string; credits: number; count: number };

/** 크레딧 사용 추이를 구간별 세로 막대 SVG 차트로 렌더한다. */
export function CreditTrendChart({
    data,
    className,
}: {
    data: CreditTrendDatum[];
    className?: string;
}) {
    if (data.length === 0) return <EmptyPlaceholder className={className} />;

    const W = 500;
    const H = 220;
    const padX = 32;
    const padTop = 28;
    const padBottom = 36;
    const chartH = H - padTop - padBottom;
    const chartW = W - padX * 2;

    const maxCredits = Math.max(1, ...data.map((d) => d.credits));
    const n = data.length;
    const bw = chartW / n;

    // x축 라벨을 모두 그리면 겹치므로, 12개 초과 시 N마다 하나씩 그린다.
    const labelStep = n > 12 ? Math.ceil(n / 12) : 1;

    /** 크레딧 값을 소수점 1자리 이하로 포맷한다(정수면 정수만). */
    const fmtCredit = (v: number): string => {
        if (v === 0) return "0";
        const rounded = Math.round(v * 10) / 10;
        return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
    };

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={cn("w-full", className)}
            role="img"
            aria-label="크레딧 사용 추이 막대 차트"
        >
            {/* 기준선 */}
            <line
                x1={padX}
                y1={H - padBottom}
                x2={W - padX}
                y2={H - padBottom}
                stroke="currentColor"
                strokeOpacity={0.2}
            />

            {data.map((d, i) => {
                const rawH = maxCredits > 0 ? (chartH * Math.max(0, d.credits)) / maxCredits : 0;
                // 값이 0이어도 1px 최소 높이로 bar를 표시한다.
                const barH = d.credits > 0 ? Math.max(1, rawH) : 0;
                const barX = padX + bw * i + bw * 0.18;
                const barW = bw * 0.64;
                const barY = H - padBottom - barH;
                const cx = padX + bw * i + bw / 2;

                return (
                    <g key={i}>
                        {/* 막대 */}
                        <rect x={barX} y={barY} width={barW} height={barH} rx={3} fill={COLORS[0]} />
                        {/* 막대 위 크레딧 값 */}
                        <text
                            x={cx}
                            y={barY - 5}
                            textAnchor="middle"
                            fontSize={10}
                            fill="currentColor"
                        >
                            {fmtCredit(d.credits)}
                        </text>
                        {/* x축 라벨 (step마다만 표시) */}
                        {i % labelStep === 0 && (
                            <text
                                x={cx}
                                y={H - padBottom + 14}
                                textAnchor="middle"
                                fontSize={10}
                                fill="currentColor"
                                fillOpacity={0.7}
                            >
                                {d.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

/* ─────────────────────────────────────────────
   2) ModelUsageChart — 많이 사용한 모델 (가로 막대)
───────────────────────────────────────────── */

/** ModelUsageChart에 전달하는 데이터 항목 타입. */
export type ModelUsageDatum = { label: string; credits: number; count: number };

/** 모델별 사용량을 가로 막대 HTML/CSS로 렌더한다. 호출자가 desc 정렬 + top-N 슬라이싱을 담당한다. */
export function ModelUsageChart({
    data,
    className,
}: {
    data: ModelUsageDatum[];
    className?: string;
}) {
    if (data.length === 0) return <EmptyPlaceholder className={className} />;

    const maxCount = Math.max(1, ...data.map((d) => d.count));

    return (
        <div className={cn("space-y-2", className)}>
            {data.map((d, i) => {
                const pct = Math.max(0, Math.min(100, (d.count / maxCount) * 100));
                const color = COLORS[i % COLORS.length];
                // 크레딧 주석: 소수점 1자리.
                const annotation = `${d.count}회 · ${d.credits.toFixed(1)}크레딧`;

                return (
                    <div key={i} className="flex items-center gap-2">
                        {/* 모델 라벨 */}
                        <span
                            className="w-32 shrink-0 truncate text-xs text-muted-foreground"
                            title={d.label}
                        >
                            {d.label}
                        </span>
                        {/* 막대 트랙 */}
                        <div className="relative flex-1 h-5 rounded bg-muted overflow-hidden">
                            <div
                                className="h-full rounded transition-all"
                                style={{ width: `${pct}%`, background: color }}
                            />
                        </div>
                        {/* 값 주석 */}
                        <span className="w-40 shrink-0 text-right text-xs text-muted-foreground">
                            {annotation}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────────────────────────────
   3) CategoryDonutChart — 종류별 크레딧 비중 (도넛)
───────────────────────────────────────────── */

/** CategoryDonutChart에 전달하는 데이터 항목 타입. */
export type CategoryDonutDatum = {
    key: string;
    label: string;
    credits: number;
    count: number;
    color: string;
};

/**
 * 도넛 호(arc) 경로 문자열을 계산한다.
 * startAngle, endAngle은 라디안(0 = 12시 방향).
 */
function describeArc(cx: number, cy: number, R: number, startAngle: number, endAngle: number): string {
    const x0 = cx + R * Math.sin(startAngle);
    const y0 = cy - R * Math.cos(startAngle);
    const x1 = cx + R * Math.sin(endAngle);
    const y1 = cy - R * Math.cos(endAngle);
    const sweep = endAngle - startAngle;
    // 한 항목이 100%이면 완전한 원 — 살짝 모자라게 그려 arc를 살린다.
    if (sweep >= Math.PI * 2 - 0.001) {
        const xMid = cx + R * Math.sin(Math.PI);
        const yMid = cy - R * Math.cos(Math.PI);
        return `M ${x0} ${y0} A ${R} ${R} 0 1 1 ${xMid} ${yMid} A ${R} ${R} 0 1 1 ${x0} ${y0} Z`;
    }
    const largeArc = sweep > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

/** 종류별 크레딧 비중을 도넛 SVG 차트 + 범례로 렌더한다. */
export function CategoryDonutChart({
    data,
    className,
}: {
    data: CategoryDonutDatum[];
    className?: string;
}) {
    if (data.length === 0) return <EmptyPlaceholder className={className} />;

    const C = 80; // SVG 중심 좌표
    const R = 68; // 바깥 반지름
    const hole = 40; // 안쪽 구멍 반지름
    const SIZE = C * 2;

    const total = data.reduce((s, d) => s + Math.max(0, d.credits), 0);

    // 누적 각도로 각 항목의 호 경로를 계산한다.
    let acc = 0;
    const arcs = data.map((d) => {
        const frac = total > 0 ? Math.max(0, d.credits) / total : 0;
        const startAngle = acc * 2 * Math.PI;
        acc += frac;
        const endAngle = acc * 2 * Math.PI;
        const path = describeArc(C, C, R, startAngle, endAngle);
        const pct = Math.round(frac * 100);
        return { path, frac, pct, d };
    });

    return (
        <div className={cn("flex flex-wrap items-center gap-4", className)}>
            {/* 도넛 SVG */}
            <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="w-40 shrink-0"
                role="img"
                aria-label="종류별 크레딧 비중 도넛 차트"
            >
                {total === 0 ? (
                    // 데이터 합계가 0이면 흐릿한 링 하나를 보여 준다.
                    <circle cx={C} cy={C} r={R} fill="currentColor" fillOpacity={0.1} />
                ) : (
                    arcs.map((a, i) =>
                        a.frac > 0 ? (
                            <path key={i} d={a.path} fill={a.d.color} />
                        ) : null,
                    )
                )}
                {/* 도넛 구멍 — 카드 배경색으로 덮는다 */}
                <circle cx={C} cy={C} r={hole} fill="var(--card, white)" />
            </svg>

            {/* 범례 */}
            <ul className="flex-1 space-y-1.5 text-xs">
                {data.map((d, i) => {
                    const frac = total > 0 ? Math.max(0, d.credits) / total : 0;
                    const pct = Math.round(frac * 100);
                    return (
                        <li key={i} className="flex items-start gap-2">
                            <span
                                className="mt-0.5 inline-block size-3 shrink-0 rounded-sm"
                                style={{ background: d.color }}
                            />
                            <span className="text-foreground">{d.label}</span>
                            <span className="ml-auto shrink-0 text-right text-muted-foreground">
                                {d.credits.toFixed(1)}크레딧 ({pct}%)
                                <br />
                                {d.count}회
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* ─────────────────────────────────────────────
   4) CategoryCountBars — 종류별 생성 횟수 (가로 막대)
───────────────────────────────────────────── */

/** CategoryCountBars에 전달하는 데이터 항목 타입. */
export type CategoryCountDatum = {
    key: string;
    label: string;
    count: number;
    color: string;
};

/** 종류별 생성 횟수를 가로 막대 HTML/CSS로 렌더한다. */
export function CategoryCountBars({
    data,
    className,
}: {
    data: CategoryCountDatum[];
    className?: string;
}) {
    if (data.length === 0) return <EmptyPlaceholder className={className} />;

    const maxCount = Math.max(1, ...data.map((d) => d.count));

    return (
        <div className={cn("space-y-2", className)}>
            {data.map((d, i) => {
                const pct = Math.max(0, Math.min(100, (d.count / maxCount) * 100));

                return (
                    <div key={i} className="flex items-center gap-2">
                        {/* 종류 라벨 */}
                        <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
                            {d.label}
                        </span>
                        {/* 막대 트랙 */}
                        <div className="relative flex-1 h-5 rounded bg-muted overflow-hidden">
                            <div
                                className="h-full rounded transition-all"
                                style={{ width: `${pct}%`, background: d.color }}
                            />
                        </div>
                        {/* 횟수 주석 */}
                        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {d.count}회
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
