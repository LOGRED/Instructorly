/**
 * 창작 실습 추가 다이얼로그 — 한 주차에 시·동화책·에세이 창작 실습을 추가한다.
 * 강사가 장르와 시작 템플릿을 고르고 안내문을 적으면, 그 템플릿으로 강사 시범본이
 * 자동 구성된다(학습자는 실습 화면에서 각자 작품을 만든다).
 */
"use client";

import { useState } from "react";
import { Plus, Feather, BookOpen, PenLine, SquareDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { createAtelier, saveProgram } from "@/lib/api";
import type { Program, AtelierGenre } from "@/lib/types";
import { GENRE_LIST, templatesForGenre } from "@/lib/atelier-templates";
import { cn } from "@/lib/utils";
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

/** 장르 아이콘 이름 → 컴포넌트. */
const GENRE_ICONS: Record<string, LucideIcon> = { Feather, BookOpen, PenLine };

interface AddAtelierDialogProps {
    program: Program;
    weekId: string;
    userId: string;
    nickname: string;
    onSaved: (updated: Program) => void;
}

export function AddAtelierDialog({ program, weekId, userId, nickname, onSaved }: AddAtelierDialogProps) {
    const [open, setOpen] = useState(false);
    const [genre, setGenre] = useState<AtelierGenre>("poem");
    const [templateId, setTemplateId] = useState<string>("");
    // 빈 작품(블럭으로 직접) 모드 — 장르 대신 고르면 시작 템플릿을 건너뛴다.
    const [blank, setBlank] = useState(false);
    const [title, setTitle] = useState("");
    const [brief, setBrief] = useState("");
    const [loading, setLoading] = useState(false);

    const templates = templatesForGenre(genre);

    // 다이얼로그가 닫히면 입력값을 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) {
            setGenre("poem");
            setTemplateId("");
            setBlank(false);
            setTitle("");
            setBrief("");
        }
    }

    // 장르를 바꾸면 빈 작품 모드를 풀고 선택한 템플릿을 초기화한다(다른 장르의 템플릿이 남지 않도록).
    function pickGenre(g: AtelierGenre) {
        setGenre(g);
        setTemplateId("");
        setBlank(false);
    }

    // 빈 작품으로 시작한다 — 템플릿 없이 블럭으로 직접 구성(장르는 문서 기본값용으로 유지).
    function pickBlank() {
        setBlank(true);
        setTemplateId("");
    }

    // 창작 실습을 만들고 해당 주차 맨 아래에 추가한 뒤 저장한다.
    async function handleAdd() {
        if (!title.trim()) {
            toast.error("실습 제목을 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const atelier = await createAtelier({
                programId: program.id,
                genre,
                templateId: templateId || undefined,
                title: title.trim(),
                brief: brief.trim(),
                authorId: userId,
                authorName: nickname,
            });

            const updatedWeeks = program.weeks.map((w) =>
                w.id === weekId
                    ? { ...w, items: [...w.items, { type: "atelier" as const, id: atelier.id }] }
                    : w,
            );
            const updated = await saveProgram({ ...program, weeks: updatedWeeks });

            toast.success("창작 실습이 추가되었습니다.");
            handleOpenChange(false);
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "창작 실습 추가에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <Feather />
                실습 추가
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>창작 실습 추가</DialogTitle>
                    <DialogDescription>
                        시·동화책·에세이를 만들어 책과 PDF로 내려받는 실습입니다. 학습자는 각자 자기 작품을 만들어요.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    {/* 제목 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="atelier-title">실습 제목 *</Label>
                        <Input
                            id="atelier-title"
                            placeholder="예: 나의 첫 시집 만들기"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* 장르 */}
                    <div className="flex flex-col gap-1.5">
                        <Label>어떤 작품을 만들까요? *</Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {GENRE_LIST.map((g) => {
                                const Icon = GENRE_ICONS[g.icon] ?? Feather;
                                const active = !blank && genre === g.genre;
                                return (
                                    <button
                                        key={g.genre}
                                        type="button"
                                        onClick={() => pickGenre(g.genre)}
                                        disabled={loading}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                                            active ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-muted/60",
                                        )}
                                    >
                                        <Icon className="size-5 text-brand" />
                                        <span className="text-sm font-semibold">{g.label}</span>
                                    </button>
                                );
                            })}
                            {/* 빈 작품 — 템플릿 없이 블럭으로 직접(장르와 같은 줄에서 고른다). */}
                            <button
                                type="button"
                                onClick={pickBlank}
                                disabled={loading}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-3 text-center transition-colors",
                                    blank ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-muted/60",
                                )}
                            >
                                <SquareDashed className="size-5 text-muted-foreground" />
                                <span className="text-sm font-semibold">빈 작품</span>
                            </button>
                        </div>
                    </div>

                    {/* 시작 템플릿 — 빈 작품 모드에선 숨기고 안내만 보여 준다. */}
                    {!blank ? (
                    <div className="flex flex-col gap-1.5">
                        <Label>시작 템플릿</Label>
                        <div className="flex flex-col gap-1.5">
                            {templates.map((tpl) => {
                                const active = templateId === tpl.id;
                                return (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => setTemplateId(tpl.id)}
                                        disabled={loading}
                                        className={cn(
                                            "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                                            active ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-muted/60",
                                        )}
                                    >
                                        <span className="flex flex-col">
                                            <span className="text-sm font-medium">{tpl.label}</span>
                                            <span className="text-xs text-muted-foreground">{tpl.blurb}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => setTemplateId("")}
                                disabled={loading}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left transition-colors",
                                    templateId === "" ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-muted/60",
                                )}
                            >
                                <SquareDashed className="size-4 text-muted-foreground" />
                                <span className="text-sm font-medium">빈 작품 (블럭으로 직접)</span>
                            </button>
                        </div>
                    </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                            <SquareDashed className="size-4 shrink-0" />
                            빈 작품으로 시작해요. 블럭으로 직접 구성합니다.
                        </div>
                    )}

                    {/* 안내문 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="atelier-brief">학습자 안내문 (선택)</Label>
                        <Textarea
                            id="atelier-brief"
                            placeholder="예: 좋아하는 계절을 주제로 짧은 시 한 편을 지어 보세요."
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            disabled={loading}
                            className="min-h-16"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" disabled={loading} />}>취소</DialogClose>
                    <Button onClick={handleAdd} disabled={loading}>
                        <Plus />
                        {loading ? "추가 중..." : "추가하기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
