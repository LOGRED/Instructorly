/**
 * 홈 랜딩 페이지 — 히어로, 기능 그리드, 사용 방법, CTA 밴드, 푸터를 포함하는 서비스 소개 페이지.
 */
import Link from "next/link";
import { LayoutGrid, BookOpenText, Sparkles, Type } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const features = [
    {
        icon: LayoutGrid,
        title: "블럭으로 강의 제작",
        description:
            "이미지·동영상·AI 글쓰기 블럭을 '/' 명령이나 드래그로 끼워 넣어요.",
    },
    {
        icon: BookOpenText,
        title: "페이지를 넘기며 학습",
        description: "스크롤 대신 한 장씩 넘기는 편안한 강의 화면.",
    },
    {
        icon: Sparkles,
        title: "진짜 AI 생성",
        description:
            "프롬프트로 이미지·글을 실제로 생성하고, 몇 초 걸렸는지 보여줘요.",
    },
    {
        icon: Type,
        title: "큰 글씨·고대비",
        description: "어르신도 편하게. 글자 크기 3단계와 고대비 모드.",
    },
];

const steps = [
    {
        num: "01",
        title: "회원가입하고 시작",
        desc: "아이디·비밀번호로 가입하고 강사/학생을 선택하세요.",
    },
    {
        num: "02",
        title: "강의를 만들거나 선택",
        desc: "AI 블럭으로 강의를 제작하거나 들을 강의를 고르세요.",
    },
    {
        num: "03",
        title: "배우고 자랑하기",
        desc: "페이지를 넘기며 배우고 채팅으로 결과물을 공유하세요.",
    },
];

export default function HomePage() {
    return (
        <div className="flex min-h-full flex-col">
            <SiteHeader />

            <main className="flex-1">
                {/* ── HERO ── */}
                <section className="py-20 sm:py-32">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="eyebrow mb-5">AI 강사 양성 LMS</p>
                            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                                누구나, AI 강사가 됩니다.
                            </h1>
                            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                                이미지·동영상·AI 블럭으로 강의를 만들고, 페이지를 넘기며
                                배우고, 학생들과 결과물을 자랑하세요.
                            </p>
                            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <Button
                                    render={<Link href="/login" />}
                                    size="lg"
                                    className="px-8 text-base"
                                >
                                    지금 시작하기
                                </Button>
                                <Button
                                    render={<Link href="/programs" />}
                                    variant="outline"
                                    size="lg"
                                    className="px-8 text-base"
                                >
                                    강좌 둘러보기
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── FEATURE GRID ── */}
                <section className="border-t py-16 sm:py-24">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {features.map(({ icon: Icon, title, description }) => (
                                <Card key={title} className="border bg-card">
                                    <CardHeader className="pb-3">
                                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                            <Icon className="size-5 text-muted-foreground" />
                                        </div>
                                        <CardTitle className="text-base font-semibold">
                                            {title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <CardDescription className="text-sm leading-relaxed">
                                            {description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section className="border-t py-16 sm:py-24">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <p className="eyebrow mb-10 text-center">사용 방법</p>
                        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
                            {steps.map(({ num, title, desc }) => (
                                <div key={num} className="flex flex-col gap-3">
                                    <span className="mono text-3xl text-muted-foreground">
                                        {num}
                                    </span>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {title}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA BAND ── */}
                <section className="py-16 sm:py-24">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <div className="rounded-xl border bg-muted/40 p-8 text-center sm:p-14">
                            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                지금 바로 첫 강의를 만들어 보세요
                            </h2>
                            <p className="mt-3 text-base text-muted-foreground">
                                간단한 회원가입으로 바로 시작할 수 있어요.
                            </p>
                            <div className="mt-8">
                                <Button
                                    render={<Link href="/login" />}
                                    size="lg"
                                    className="px-10 text-base"
                                >
                                    무료로 시작하기
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:px-6">
                    <BrandLogo showWordmark size={24} href="/" />
                    <p className="eyebrow text-center">
                        © 2026 Instructorly · AI 강사 양성 플랫폼 프로토타입
                    </p>
                </div>
            </footer>
        </div>
    );
}
