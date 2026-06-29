/**
 * 차트 블럭 카드 — 막대·꺾은선·원형 그래프를 편집(빌더)하거나 읽기 전용(학습자)으로 보여 준다.
 * 외부 차트 라이브러리 없이 순수 SVG로 그려 의존성을 늘리지 않는다(프로토타입 친화).
 * `authoring=true`(빌더)는 종류 선택 + 항목 라벨/값 편집·추가·삭제를, `authoring=false`는 그래프만 렌더한다.
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ChartBlock } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** 차트 종류별 한국어 라벨(탭 버튼용). */
const KIND_LABEL: Record<ChartBlock["chartKind"], string> = {
    bar: "막대",
    line: "꺾은선",
    pie: "원형",
};

/** 항목 색상 팔레트(원형·막대 채움). Tailwind 토큰 대신 고정 HSL로 대비를 보장한다. */
const COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#ec4899",
    "#14b8a6",
    "#a855f7",
];

/** 막대 그래프 SVG. 값 비례 높이로 세로 막대를 그린다. */
function BarChart({ data }: { data: ChartBlock["data"] }) {
    const W = 480;
    const H = 220;
    const pad = 28;
    const max = Math.max(1, ...data.map((d) => d.value));
    const n = Math.max(1, data.length);
    const bw = (W - pad * 2) / n;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="막대 그래프">
            <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="currentColor" strokeOpacity={0.2} />
            {data.map((d, i) => {
                const h = ((H - pad * 2) * d.value) / max;
                const x = pad + bw * i + bw * 0.18;
                const w = bw * 0.64;
                const y = H - pad - h;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={w} height={h} rx={4} fill={COLORS[i % COLORS.length]} />
                        <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="currentColor">
                            {d.value}
                        </text>
                        <text x={x + w / 2} y={H - pad + 14} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

/** 꺾은선 그래프 SVG. 값 비례 점을 선으로 잇는다. */
function LineChart({ data }: { data: ChartBlock["data"] }) {
    const W = 480;
    const H = 220;
    const pad = 28;
    const max = Math.max(1, ...data.map((d) => d.value));
    const n = Math.max(1, data.length);
    const step = n > 1 ? (W - pad * 2) / (n - 1) : 0;
    const pts = data.map((d, i) => {
        const x = pad + step * i;
        const y = H - pad - ((H - pad * 2) * d.value) / max;
        return { x, y, d };
    });
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="꺾은선 그래프">
            <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="currentColor" strokeOpacity={0.2} />
            {pts.length > 1 && <path d={path} fill="none" stroke={COLORS[0]} strokeWidth={2.5} />}
            {pts.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r={4} fill={COLORS[0]} />
                    <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={11} fill="currentColor">
                        {p.d.value}
                    </text>
                    <text x={p.x} y={H - pad + 14} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
                        {p.d.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}

/** 원형 그래프 SVG. 값 비율로 부채꼴을 그리고 옆에 범례를 둔다. */
function PieChart({ data }: { data: ChartBlock["data"] }) {
    const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
    const R = 90;
    const C = 110;
    let acc = 0;
    const arcs = data.map((d, i) => {
        const frac = total > 0 ? Math.max(0, d.value) / total : 0;
        const a0 = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        const large = frac > 0.5 ? 1 : 0;
        const x0 = C + R * Math.cos(a0);
        const y0 = C + R * Math.sin(a0);
        const x1 = C + R * Math.cos(a1);
        const y1 = C + R * Math.sin(a1);
        // 한 항목이 100%면 원 전체라 호 좌표가 겹쳐 사라진다 — 꽉 찬 원으로 대체.
        const path =
            frac >= 0.999
                ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
                : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
        return { path, color: COLORS[i % COLORS.length], frac, d };
    });
    return (
        <div className="flex flex-wrap items-center gap-4">
            <svg viewBox={`0 0 ${C * 2} ${C * 2}`} className="w-44 shrink-0" role="img" aria-label="원형 그래프">
                {total === 0 ? (
                    <circle cx={C} cy={C} r={R} fill="currentColor" fillOpacity={0.1} />
                ) : (
                    arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)
                )}
            </svg>
            <ul className="space-y-1 text-sm">
                {data.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                        <span className="inline-block size-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        <span>{d.label}</span>
                        <span className="text-muted-foreground">
                            {d.value}
                            {total > 0 && ` (${Math.round((Math.max(0, d.value) / total) * 100)}%)`}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** 종류에 맞는 그래프를 그린다(공통 렌더). */
function ChartGraph({ block }: { block: ChartBlock }) {
    if (block.chartKind === "line") return <LineChart data={block.data} />;
    if (block.chartKind === "pie") return <PieChart data={block.data} />;
    return <BarChart data={block.data} />;
}

// 차트 블럭 카드를 렌더한다(빌더=편집, 학습자=읽기 전용).
export function ChartBlockCard({
    block,
    onChange,
    authoring = true,
}: {
    block: ChartBlock;
    onChange: (b: ChartBlock) => void;
    /** 빌더(작성자)면 true — 종류·라벨·값 편집. 학습자면 false — 그래프만. */
    authoring?: boolean;
}) {
    // 항목 라벨을 고친다.
    function setLabel(i: number, label: string) {
        onChange({ ...block, data: block.data.map((d, di) => (di === i ? { ...d, label } : d)) });
    }

    // 항목 값을 고친다(숫자만, 빈값은 0).
    function setValue(i: number, raw: string) {
        const value = raw === "" ? 0 : Number(raw);
        if (Number.isNaN(value)) return;
        onChange({ ...block, data: block.data.map((d, di) => (di === i ? { ...d, value } : d)) });
    }

    // 끝에 빈 항목을 추가한다.
    function addItem() {
        onChange({ ...block, data: [...block.data, { label: "", value: 0 }] });
    }

    // 지정 항목을 삭제한다(최소 1개 유지).
    function removeItem(i: number) {
        if (block.data.length <= 1) return;
        onChange({ ...block, data: block.data.filter((_, di) => di !== i) });
    }

    // 학습자(읽기 전용) — 제목 + 그래프.
    if (!authoring) {
        return (
            <figure className="space-y-2 rounded-xl border bg-card p-4 text-foreground">
                {block.title && <figcaption className="text-center font-semibold">{block.title}</figcaption>}
                <ChartGraph block={block} />
            </figure>
        );
    }

    // 빌더(작성자) — 종류 탭 + 제목 + 항목 편집 + 미리보기.
    return (
        <div className="space-y-3 rounded-xl border bg-card p-3">
            <div className="flex gap-1">
                {(Object.keys(KIND_LABEL) as ChartBlock["chartKind"][]).map((k) => (
                    <Button
                        key={k}
                        type="button"
                        size="sm"
                        variant={block.chartKind === k ? "default" : "outline"}
                        onClick={() => onChange({ ...block, chartKind: k })}
                    >
                        {KIND_LABEL[k]}
                    </Button>
                ))}
            </div>

            <Input
                value={block.title}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder="차트 제목 (선택)"
            />

            <div className="space-y-1.5">
                {block.data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        <Input
                            value={d.label}
                            onChange={(e) => setLabel(i, e.target.value)}
                            placeholder={`항목 ${i + 1}`}
                            className="h-9 flex-1"
                            aria-label={`항목 ${i + 1} 라벨`}
                        />
                        <Input
                            type="number"
                            value={d.value}
                            onChange={(e) => setValue(i, e.target.value)}
                            className="h-9 w-24"
                            aria-label={`항목 ${i + 1} 값`}
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 shrink-0 text-muted-foreground"
                            onClick={() => removeItem(i)}
                            disabled={block.data.length <= 1}
                            aria-label={`항목 ${i + 1} 삭제`}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="size-4" /> 항목 추가
            </Button>

            {/* 실시간 미리보기 */}
            <div className="rounded-lg border bg-background p-3 text-foreground">
                {block.title && <p className="mb-1 text-center text-sm font-semibold">{block.title}</p>}
                <ChartGraph block={block} />
            </div>
        </div>
    );
}
