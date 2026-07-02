/**
 * 사용 설명서 — 전체 흐름(개요) 페이지. 로그인한 역할(강사/학생)에 맞는 흐름 그림과
 * 모든 기능 목록을 큼직한 카드로 보여 준다. 카드를 누르면 그 기능의 설명 페이지로 간다.
 * 상단바·왼쪽 목차는 GuideShell이 그린다.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { useIdentity } from "@/lib/identity";
import { GuideShell } from "./_components/guide-shell";
import { guideForRole, type GuideSection } from "./_components/guide-data";
import { GuideIcon } from "./_components/guide-icon";

// 전체 흐름을 글자 칸으로 보여 준다(그림이 없을 때도 항상 보인다).
function FlowStrip({
    flow,
}: {
    flow: { label: string; icon: LucideIcon }[];
}) {
    return (
        <ol className="flex flex-wrap items-stretch gap-3">
            {flow.map(({ label, icon: Icon }, i) => (
                <li key={label} className="flex items-center gap-3">
                    <div className="flex min-w-[7rem] flex-col items-center gap-2 rounded-xl bg-muted/60 px-4 py-4 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-background ring-1 ring-border">
                            <Icon className="size-6 text-foreground" />
                        </div>
                        <span className="text-base font-semibold text-foreground">
                            {label}
                        </span>
                    </div>
                    {i < flow.length - 1 && (
                        <ChevronRight className="size-6 shrink-0 text-muted-foreground" />
                    )}
                </li>
            ))}
        </ol>
    );
}

// 기능 하나를 누를 수 있는 큰 카드로 그린다(누르면 그 설명 페이지로 이동).
function SectionLinkCard({ section }: { section: GuideSection }) {
    return (
        <Link
            href={`/guide/${section.id}`}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/50"
        >
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-border">
                <GuideIcon
                    section={section}
                    imgClassName="size-11 object-contain"
                    iconClassName="size-6 text-foreground"
                />
            </div>
            <div className="min-w-0">
                <h3 className="text-lg font-bold leading-snug text-foreground">
                    {section.title}
                </h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                    {section.summary}
                </p>
            </div>
            <ChevronRight className="ml-auto size-5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}

// 전체 흐름(개요) 페이지를 그린다.
export default function GuidePage() {
    const role = useIdentity((s) => s.role);
    const hydrated = useIdentity((s) => s.hydrated);
    const [imgOk, setImgOk] = useState(true);

    const guide = guideForRole(role);
    const first = guide.sections[0];

    return (
        <GuideShell>
            {!hydrated ? (
                // 하이드레이션 전에는 역할이 확정되지 않아 자리만 잡아 둔다.
                <div className="space-y-6">
                    <div className="h-9 w-64 animate-pulse rounded bg-muted" />
                    <div className="h-48 animate-pulse rounded-2xl bg-muted" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* 머리말 */}
                    <header>
                        <p className="eyebrow mb-2">사용 설명서</p>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {guide.title}
                        </h1>
                        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                            {guide.intro}
                        </p>
                    </header>

                    {/* 전체 흐름 그림 + 글자 흐름 */}
                    <section className="rounded-2xl border bg-card p-5 sm:p-7">
                        <h2 className="mb-4 text-xl font-bold text-foreground sm:text-2xl">
                            전체 흐름 한눈에 보기
                        </h2>
                        {/* 흐름 그림만 보여 준다. 그림을 못 불러올 때만 글자 흐름으로 대체. */}
                        {imgOk ? (
                            <img
                                src={guide.flowImage}
                                alt={`${guide.title} 전체 흐름 그림`}
                                className="w-full rounded-xl border"
                                onError={() => setImgOk(false)}
                            />
                        ) : (
                            <FlowStrip flow={guide.flow} />
                        )}
                    </section>

                    {/* 처음부터 차례로 보기 */}
                    {first && (
                        <Link
                            href={`/guide/${first.id}`}
                            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-5 text-xl font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.01]"
                        >
                            처음부터 차례로 보기
                            <ChevronRight className="size-6" />
                        </Link>
                    )}

                    {/* 모든 기능 카드 */}
                    <section>
                        <h2 className="mb-4 text-xl font-bold text-foreground sm:text-2xl">
                            무엇을 할 수 있나요? (눌러서 자세히 보기)
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {guide.sections.map((s) => (
                                <SectionLinkCard key={s.id} section={s} />
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </GuideShell>
    );
}
