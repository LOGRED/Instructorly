/**
 * 기능별 설명 본문 — 주소의 항목(useParams)에 맞는 한 가지 기능 설명을 보여 준다.
 * 지금 로그인한 역할(강사/학생)의 설명만 보여 주므로, 학생은 강사용 설명을 볼 수 없다.
 * 각 단계는 번호 배지 + 행동 + 화면 변화 설명 + (있으면) 스크린샷 순서로 이어지고,
 * 스크린샷을 누르면 크게 볼 수 있다. 그 아래로 기능 표와 도움말, 이전/다음 이동 단추가 온다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, X, Lightbulb } from "lucide-react";

import { useIdentity } from "@/lib/identity";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { GuideShots } from "./guide-shots";
import { GuideIcon } from "./guide-icon";
import {
    guideForRole,
    adjacentSections,
    type GuideStep,
} from "./guide-data";

// 한 단계의 스크린샷 — 누르면 확대해서 크게 볼 수 있다. 못 불러오면 조용히 숨긴다.
function StepShot({ step, no }: { step: GuideStep; no: number }) {
    const [ok, setOk] = useState(true);
    const [zoom, setZoom] = useState(false);

    if (!ok || !step.shot) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setZoom(true)}
                className="group relative mt-3 block w-full cursor-zoom-in overflow-hidden rounded-2xl border bg-card shadow-sm"
                aria-label={`${no}단계 사진 크게 보기`}
            >
                <img
                    src={step.shot}
                    alt={`${no}단계: ${step.title}`}
                    loading="lazy"
                    onError={() => setOk(false)}
                    className="w-full object-contain"
                />
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white opacity-90 transition-opacity group-hover:opacity-100">
                    <Maximize2 className="size-4" />
                    눌러서 크게
                </span>
            </button>

            {/* 확대 창(라이트박스) */}
            <Dialog open={zoom} onOpenChange={setZoom}>
                <DialogContent
                    showCloseButton={false}
                    className="max-w-[96vw] border-0 bg-transparent p-0 shadow-none sm:max-w-6xl"
                >
                    <DialogTitle className="sr-only">
                        {no}단계: {step.title} (크게 보기)
                    </DialogTitle>
                    <div className="relative">
                        <img
                            src={step.shot}
                            alt={`${no}단계: ${step.title}`}
                            className="max-h-[86vh] w-full rounded-xl bg-black object-contain"
                        />
                        <button
                            type="button"
                            onClick={() => setZoom(false)}
                            aria-label="닫기"
                            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
                        >
                            <X className="size-6" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// 기능별 설명 본문을 그린다.
export function GuideArticle() {
    const { section: sectionId } = useParams<{ section: string }>();
    const role = useIdentity((s) => s.role);
    const hydrated = useIdentity((s) => s.hydrated);

    // 하이드레이션 전에는 역할이 확정되지 않아 자리만 잡아 둔다.
    if (!hydrated) {
        return (
            <div className="space-y-4">
                <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-6 w-full animate-pulse rounded bg-muted" />
                <div className="h-40 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    const guide = guideForRole(role);
    const section = guide.sections.find((s) => s.id === sectionId) ?? null;

    // 내 역할에 없는 설명(예: 학생이 강사용 주소로 들어온 경우)은 막는다.
    if (!section) {
        return (
            <div className="rounded-2xl border bg-card p-8 text-center sm:p-12">
                <p className="text-2xl font-bold text-foreground">
                    이 설명은 볼 수 없어요
                </p>
                <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">
                    내 설명서에 없는 항목이에요. 아래 단추를 눌러 내 설명서로 돌아가세요.
                </p>
                <Link
                    href="/guide"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground"
                >
                    내 설명서로 가기
                    <ChevronRight className="size-5" />
                </Link>
            </div>
        );
    }

    const { prev, next } = adjacentSections(guide, section.id);
    const hasStepShots = section.steps.some((s) => s.shot);

    return (
        <article className="space-y-8">
            {/* 제목 줄 */}
            <header className="flex items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-border">
                    <GuideIcon
                        section={section}
                        imgClassName="size-12 object-contain"
                        iconClassName="size-7 text-foreground"
                    />
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                        {section.title}
                    </h1>
                    <p className="mt-2 text-lg leading-relaxed text-muted-foreground">
                        {section.summary}
                    </p>
                </div>
            </header>

            {/* 어디서 하나요 */}
            <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-4 py-3">
                <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <p className="text-base text-foreground">
                    <span className="font-semibold">어디서 하나요?</span> {section.where}
                </p>
            </div>

            {/* 단계들 — 번호 + 행동 + 설명 + (있으면) 스크린샷 순서로 차례로 보여 준다 */}
            <ol className="space-y-8">
                {section.steps.map((step, i) => (
                    <li key={i}>
                        <div className="flex gap-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1 pt-1">
                                <p className="text-lg font-semibold text-foreground sm:text-xl">
                                    {step.title}
                                </p>
                                <p className="mt-1 text-base leading-relaxed text-muted-foreground sm:text-lg">
                                    {step.detail}
                                </p>
                                <StepShot step={step} no={i + 1} />
                            </div>
                        </div>
                    </li>
                ))}
            </ol>

            {/* 단계에 사진이 하나도 없는 섹션은 기존 화면 사진 갤러리로 대신 보여 준다 */}
            {!hasStepShots && <GuideShots shots={section.shots} />}

            {/* 이 화면에서 할 수 있는 일 — 기능 표 */}
            {section.features && section.features.length > 0 && (
                <section aria-label="이 화면에서 할 수 있는 일">
                    <h2 className="mb-3 text-xl font-bold text-foreground">
                        이 화면에서 할 수 있는 일
                    </h2>
                    <div className="overflow-hidden rounded-2xl border">
                        <div className="hidden bg-muted/60 text-base font-semibold text-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_2fr]">
                            <span className="px-4 py-3">기능 이름</span>
                            <span className="px-4 py-3">사용 방법</span>
                        </div>
                        <div className="divide-y">
                            {section.features.map((f, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-1 gap-1 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_2fr] sm:items-start sm:gap-0 sm:py-3"
                                >
                                    <span className="text-base font-bold text-foreground sm:font-semibold">
                                        {f.name}
                                    </span>
                                    <span className="text-base leading-relaxed text-muted-foreground">
                                        {f.how}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* 도움말 */}
            {section.tips && section.tips.length > 0 && (
                <section aria-label="도움말" className="rounded-2xl border bg-amber-50 p-5 dark:bg-amber-950/20">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                        <Lightbulb className="size-5 text-amber-500" />
                        도움말
                    </h2>
                    <ul className="space-y-2">
                        {section.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-base leading-relaxed text-foreground">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                                {tip}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* 이전 / 다음 이동 */}
            <nav className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-stretch sm:justify-between">
                {prev ? (
                    <Link
                        href={`/guide/${prev.id}`}
                        className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-4 text-left transition-colors hover:bg-muted sm:max-w-[48%]"
                    >
                        <ChevronLeft className="size-6 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                            <span className="block text-sm text-muted-foreground">이전</span>
                            <span className="block truncate text-base font-semibold text-foreground">
                                {prev.title}
                            </span>
                        </span>
                    </Link>
                ) : (
                    <span className="hidden flex-1 sm:block sm:max-w-[48%]" />
                )}

                {next ? (
                    <Link
                        href={`/guide/${next.id}`}
                        className="flex flex-1 items-center justify-end gap-3 rounded-xl border px-4 py-4 text-right transition-colors hover:bg-muted sm:max-w-[48%]"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm text-muted-foreground">다음</span>
                            <span className="block truncate text-base font-semibold text-foreground">
                                {next.title}
                            </span>
                        </span>
                        <ChevronRight className="size-6 shrink-0 text-muted-foreground" />
                    </Link>
                ) : (
                    <Link
                        href="/guide"
                        className="flex flex-1 items-center justify-end gap-3 rounded-xl border px-4 py-4 text-right transition-colors hover:bg-muted sm:max-w-[48%]"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm text-muted-foreground">마지막</span>
                            <span className="block text-base font-semibold text-foreground">
                                전체 흐름으로 돌아가기
                            </span>
                        </span>
                        <ChevronRight className="size-6 shrink-0 text-muted-foreground" />
                    </Link>
                )}
            </nav>
        </article>
    );
}
