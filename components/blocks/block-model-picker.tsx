/**
 * 블럭 모델 선택기 — 강사(authoring)는 이 블럭이 쓸 AI 모델을 카탈로그에서 골라 잠그고,
 * 학생(읽기 전용)은 잠긴 모델 이름과 크레딧 단가만 본다. 카테고리는 블럭 타입에서 정해진다.
 */
"use client";

import { Bot, Coins, Lock } from "lucide-react";
import type { StudioCategory, StudioModel } from "@/lib/types";
import { formatCredits } from "@/lib/credits";
import { useStudioCatalog } from "@/lib/use-studio-catalog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

/** 한 모델의 크레딧 단가를 사람이 읽는 한 줄로 만든다. */
export function formatModelPrice(m: StudioModel): string {
    if (m.free) return "무료 · 0 크레딧";
    if (m.category === "text") {
        const i = m.pricing.inputPerMTokCredits;
        const o = m.pricing.outputPerMTokCredits;
        if (i != null && o != null) {
            return `입력 ${formatCredits(i)} · 출력 ${formatCredits(o)} 크레딧 / 100만 토큰`;
        }
        return "생성 후 정산";
    }
    if (m.category === "image") {
        return m.pricing.perImageCredits != null
            ? `약 ${formatCredits(m.pricing.perImageCredits)} 크레딧 / 장`
            : "생성 후 정산";
    }
    // video · audio
    return m.pricing.perRequestCredits != null
        ? `약 ${formatCredits(m.pricing.perRequestCredits)} 크레딧 / 건`
        : "생성 후 정산";
}

/** 블럭의 AI 모델 선택기를 렌더한다. */
export function BlockModelPicker({
    category,
    model,
    modelLabel,
    onChange,
    authoring,
}: {
    category: StudioCategory;
    model?: string;
    modelLabel?: string;
    onChange: (model: string, label: string) => void;
    /** 강사 빌더면 true(편집 가능), 학생이면 false(읽기 전용). */
    authoring: boolean;
}) {
    const { catalog, loading } = useStudioCatalog();
    const models = (catalog?.models ?? []).filter((m) => m.category === category);
    const selected = models.find((m) => m.id === model);
    const priceText = selected ? formatModelPrice(selected) : null;

    // 학생(읽기 전용) — 잠긴 모델 이름과 단가를 칩으로만 보여 준다.
    if (!authoring) {
        return (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <Bot className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{modelLabel || model || "기본 모델"}</span>
                <Lock className="size-3 text-muted-foreground" />
                {priceText && (
                    <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                        <Coins className="size-3 text-amber-500" />
                        {priceText}
                    </span>
                )}
            </div>
        );
    }

    // 강사(빌더) — 카탈로그에서 모델을 골라 이 블럭에 잠근다.
    return (
        <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" />
                이 블럭에 쓸 AI 모델 — 학생은 이 모델로만 학습합니다
            </div>
            <Select
                value={model ?? ""}
                onValueChange={(value) => {
                    const id = String(value);
                    const found = models.find((m) => m.id === id);
                    onChange(id, found?.label ?? id);
                }}
            >
                <SelectTrigger className="w-full" disabled={loading}>
                    <SelectValue placeholder={loading ? "모델 불러오는 중…" : "모델을 선택하세요"}>
                        {modelLabel || model || (loading ? "모델 불러오는 중…" : "모델을 선택하세요")}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                    {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                            <span className="flex w-full flex-col gap-0.5 py-0.5">
                                <span className="flex items-center gap-1.5 font-medium">
                                    {m.label}
                                    {m.free && (
                                        <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                            무료
                                        </span>
                                    )}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {formatModelPrice(m)}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {priceText && (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Coins className="size-3 text-amber-500" />
                    {priceText}
                </p>
            )}
        </div>
    );
}
