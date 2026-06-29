/**
 * 시험·연습 런너 — 실제 LLM 클론 화면을 감싸는 껍데기.
 * 위쪽에 얇은 안내 바(시험: 미션 + 제출 / 연습: 연습 모드 + 나가기)를 두고, 그 아래로
 * provider에 맞는 클론(ChatGPT·Claude·Gemini·Grok)을 꽉 채워 보여 준다. 학습자가 한 번
 * 이상 답변을 받아내면 "제출하기"가 활성화되고, 제출하면 칭찬 화면을 띄운다.
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Target, LogOut, Check, PartyPopper, RotateCcw } from "lucide-react";

import type { Drill } from "@/lib/types";
import { PROVIDERS } from "@/lib/llm-clones";
import { ProviderLogo } from "@/components/provider-logo";
import { Button } from "@/components/ui/button";
import type { LlmCloneProps } from "./_shared";
import { ChatGptClone } from "./chatgpt-clone";
import { ClaudeClone } from "./claude-clone";
import { GeminiClone } from "./gemini-clone";
import { GrokClone } from "./grok-clone";

// provider 값에 맞는 클론 컴포넌트를 고른다.
const CLONES: Record<Drill["provider"], (p: LlmCloneProps) => React.ReactNode> = {
    chatgpt: ChatGptClone,
    claude: ClaudeClone,
    gemini: GeminiClone,
    grok: GrokClone,
};

export function DrillRunner({
    drill,
    userName,
    userId,
}: {
    drill: Drill;
    userName: string;
    userId: string;
}) {
    const router = useRouter();
    const [replies, setReplies] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    const meta = PROVIDERS[drill.provider];
    const isExam = drill.kind === "exam";
    const Clone = CLONES[drill.provider] ?? ChatGptClone;

    // 어시스턴트가 답변을 한 번 끝낼 때마다 카운트를 올린다.
    const handleReply = useCallback(() => setReplies((n) => n + 1), []);

    // 강좌 상세로 돌아간다.
    function exit() {
        router.push(`/programs/${drill.programId}`);
    }

    // 시험을 제출한다 — 완료를 기록하고 칭찬 화면을 띄운다.
    function submit() {
        try {
            if (userId) {
                localStorage.setItem(`drill-done:${userId}:${drill.id}`, String(Date.now()));
            }
        } catch {
            // localStorage 사용 불가 환경은 무시.
        }
        setSubmitted(true);
    }

    const canSubmit = replies > 0;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden">
            {/* 상단 안내 바 */}
            <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    {/* 지금 따라 하는 LLM의 공식 로고 — 어떤 AI 화면인지 한눈에 */}
                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background">
                        <ProviderLogo provider={drill.provider} className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="eyebrow flex items-center gap-1.5 text-muted-foreground">
                            {/* 시험/연습 구분은 브랜드 강조색으로 작게 표시 */}
                            {isExam ? (
                                <Target className="size-3" style={{ color: meta.accent }} />
                            ) : (
                                <Check className="size-3" style={{ color: meta.accent }} />
                            )}
                            {isExam ? "시험" : "연습"} · {meta.name} 따라 하기
                        </span>
                        <span className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                            {isExam && drill.mission
                                ? drill.mission
                                : `${meta.name} 화면에서 자유롭게 연습해 보세요.`}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {isExam && (
                        <Button
                            size="sm"
                            onClick={submit}
                            disabled={!canSubmit}
                            className="text-sm"
                        >
                            <Check className="size-4" />
                            제출하기
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={exit} className="text-sm">
                        <LogOut className="size-4" />
                        나가기
                    </Button>
                </div>
            </div>

            {/* 시험인데 아직 한 번도 안 보냈으면 살짝 힌트 */}
            {isExam && !canSubmit && (
                <div className="shrink-0 bg-brand/10 px-4 py-1.5 text-center text-[12px] text-foreground/70">
                    아래 입력창에 질문을 적고 보내 보세요. 답변을 한 번 받으면 <b>제출하기</b>가 켜집니다.
                </div>
            )}

            {/* 실제 LLM 클론 화면 */}
            <div className="min-h-0 flex-1">
                <Clone userName={userName} onReplyComplete={handleReply} />
            </div>

            {/* 제출 후 칭찬 화면 */}
            {submitted && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 drill-fade-in">
                    <div className="w-full max-w-md rounded-xl bg-card p-8 text-center shadow-xl">
                        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-brand/15">
                            <PartyPopper className="size-8 text-brand" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">잘하셨어요! 🎉</h2>
                        <p className="mt-2 text-muted-foreground">
                            {meta.name} 화면에서 직접 질문하고 답변을 받아내셨습니다.
                            {isExam ? " 시험을 제출했어요." : ""}
                        </p>
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <Button variant="outline" onClick={() => setSubmitted(false)}>
                                <RotateCcw className="size-4" />
                                다시 해 보기
                            </Button>
                            <Button onClick={exit}>강좌로 돌아가기</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
