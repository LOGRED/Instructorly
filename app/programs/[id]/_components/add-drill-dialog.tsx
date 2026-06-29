/**
 * 시험·연습 추가 다이얼로그 — 한 주차에 실제 LLM 따라 하기 실습을 추가한다.
 * kind("exam"|"practice")에 따라 라벨이 시험/연습으로 바뀐다. 강사가 어떤 LLM 화면을
 * 복제할지(ChatGPT·Claude·Gemini·Grok) 카드로 고르고, 시험이면 미션 문구도 적는다.
 */
"use client";

import { useState } from "react";
import { Plus, GraduationCap, Dumbbell } from "lucide-react";
import { toast } from "sonner";

import { createDrill, saveProgram } from "@/lib/api";
import type { Program, DrillKind, LlmProvider } from "@/lib/types";
import { PROVIDER_LIST } from "@/lib/llm-clones";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "@/components/provider-logo";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddDrillDialogProps {
    program: Program;
    weekId: string;
    userId: string;
    nickname: string;
    kind: DrillKind;
    onSaved: (updated: Program) => void;
}

export function AddDrillDialog({
    program,
    weekId,
    userId,
    nickname,
    kind,
    onSaved,
}: AddDrillDialogProps) {
    const isExam = kind === "exam";
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [provider, setProvider] = useState<LlmProvider>("chatgpt");
    const [mission, setMission] = useState("");
    const [loading, setLoading] = useState(false);

    const label = isExam ? "시험" : "연습";
    const TriggerIcon = isExam ? GraduationCap : Dumbbell;

    // 다이얼로그가 닫히면 입력값을 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) {
            setTitle("");
            setProvider("chatgpt");
            setMission("");
        }
    }

    // 드릴을 만들고 해당 주차 맨 아래에 추가한 뒤 저장한다.
    async function handleAdd() {
        if (!title.trim()) {
            toast.error(`${label} 제목을 입력해 주세요.`);
            return;
        }
        if (isExam && !mission.trim()) {
            toast.error("시험 미션(학습자가 할 일)을 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const drill = await createDrill({
                programId: program.id,
                kind,
                provider,
                title: title.trim(),
                mission: mission.trim(),
                authorId: userId,
                authorName: nickname,
            });

            const updatedWeeks = program.weeks.map((w) =>
                w.id === weekId
                    ? { ...w, items: [...w.items, { type: kind, id: drill.id }] }
                    : w,
            );
            const updated = await saveProgram({ ...program, weeks: updatedWeeks });

            toast.success(`${label}이(가) 추가되었습니다.`);
            handleOpenChange(false);
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `${label} 추가에 실패했습니다.`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <TriggerIcon />
                {label} 추가
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{label} 추가</DialogTitle>
                    <DialogDescription>
                        실제 AI 사이트와 똑같은 화면에서 학습자가 직접 질문해 보는{" "}
                        {isExam ? "시험" : "연습"}을 만듭니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    {/* 제목 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="drill-title">{label} 제목 *</Label>
                        <Input
                            id="drill-title"
                            placeholder={
                                isExam ? "예: ChatGPT로 손주에게 편지 쓰기" : "예: ChatGPT 자유 연습"
                            }
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* LLM 선택 */}
                    <div className="flex flex-col gap-1.5">
                        <Label>어떤 AI 화면으로 연습할까요? *</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {PROVIDER_LIST.map((p) => {
                                const active = provider === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setProvider(p.id)}
                                        disabled={loading}
                                        className={cn(
                                            "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                                            active
                                                ? "border-brand ring-2 ring-brand/30"
                                                : "border-border hover:bg-muted/60",
                                        )}
                                    >
                                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background">
                                            <ProviderLogo provider={p.id} className="size-5" />
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="text-sm font-semibold">{p.name}</span>
                                            <span className="line-clamp-2 text-xs text-muted-foreground">
                                                {p.blurb}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 시험 미션 */}
                    {isExam && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="drill-mission">시험 미션 (학습자가 할 일) *</Label>
                            <Textarea
                                id="drill-mission"
                                placeholder="예: AI에게 '손주에게 보내는 따뜻한 편지를 써줘'라고 부탁하고 답변을 받아 보세요."
                                value={mission}
                                onChange={(e) => setMission(e.target.value)}
                                disabled={loading}
                                className="min-h-20"
                            />
                            <p className="text-xs text-muted-foreground">
                                이 문구는 시험 화면 위쪽에 안내로 보입니다.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" disabled={loading} />}>
                        취소
                    </DialogClose>
                    <Button onClick={handleAdd} disabled={loading}>
                        <Plus />
                        {loading ? "추가 중..." : "추가하기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
