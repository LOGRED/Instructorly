/**
 * 창작 실습 시작 화면 — 장르에 맞는 템플릿을 고르거나, 빈 작품(블럭으로 직접),
 * 또는 강사 예시로 시작하게 한다. 고르는 즉시 작품 문서(AtelierDoc)를 만들어 넘긴다.
 */
"use client";

import { BookOpen, Feather, Image as ImageIcon, PenLine, SquareDashed, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AtelierDoc, AtelierGenre } from "@/lib/types";
import { templatesForGenre, blankAtelierDoc, genreMeta } from "@/lib/atelier-templates";

/** 템플릿 아이콘 이름 → 컴포넌트. */
const ICONS: Record<string, LucideIcon> = { Feather, BookOpen, PenLine, Image: ImageIcon };

/** 작품 문서를 깊은 복사한다(강사 예시 복제용). */
function cloneDoc(doc: AtelierDoc): AtelierDoc {
    return JSON.parse(JSON.stringify(doc)) as AtelierDoc;
}

export function TemplatePicker({
    genre,
    sampleDoc,
    onPick,
}: {
    genre: AtelierGenre;
    /** 강사 시범본 — 있으면 '강사 예시로 시작' 카드를 보여 준다. */
    sampleDoc?: AtelierDoc | null;
    onPick: (doc: AtelierDoc) => void;
}) {
    const templates = templatesForGenre(genre);
    const meta = genreMeta(genre);

    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-brand">{meta.label} 창작 실습</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">어떻게 시작할까요?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    템플릿을 고르면 골격이 채워집니다. 빈 작품으로 시작해 블럭으로 직접 구성할 수도 있어요.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((tpl) => {
                    const Icon = ICONS[tpl.icon] ?? Feather;
                    return (
                        <button
                            key={tpl.id}
                            type="button"
                            onClick={() => onPick(tpl.build())}
                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-muted/50"
                        >
                            <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                                <Icon className="size-5" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="font-semibold">{tpl.label}</span>
                                <span className="text-sm text-muted-foreground">{tpl.blurb}</span>
                            </span>
                        </button>
                    );
                })}

                {/* 빈 작품 — 블럭으로 직접 */}
                <button
                    type="button"
                    onClick={() => onPick(blankAtelierDoc(genre))}
                    className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-muted/50"
                >
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <SquareDashed className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">빈 작품으로 시작</span>
                        <span className="text-sm text-muted-foreground">블럭을 직접 추가해 자유롭게 구성</span>
                    </span>
                </button>

                {/* 강사 예시로 시작(학생용) */}
                {sampleDoc && (
                    <button
                        type="button"
                        onClick={() => onPick(cloneDoc(sampleDoc))}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-muted/50 sm:col-span-2"
                    >
                        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                            <GraduationCap className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="font-semibold">강사 예시로 시작</span>
                            <span className="text-sm text-muted-foreground">선생님이 만든 시범 작품을 그대로 가져와 고쳐 써요</span>
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
