/**
 * 게시물 추가 다이얼로그 — 제목을 입력해 게시물을 생성하고 해당 주차에 추가한다.
 */
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createPost, saveProgram } from "@/lib/api";
import type { Program } from "@/lib/types";
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

interface AddPostDialogProps {
    program: Program;
    weekId: string;
    userId: string;
    nickname: string;
    onSaved: (updated: Program) => void;
}

export function AddPostDialog({
    program,
    weekId,
    userId,
    nickname,
    onSaved,
}: AddPostDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(false);

    // 다이얼로그 열림/닫힘 시 입력값을 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) setTitle("");
    }

    // 게시물을 생성하고 해당 주차 맨 아래에 추가한 뒤 저장한다.
    async function handleAdd() {
        if (!title.trim()) {
            toast.error("게시물 제목을 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const post = await createPost({
                programId: program.id,
                title: title.trim(),
                authorId: userId,
                authorName: nickname,
            });

            const updatedWeeks = program.weeks.map((w) =>
                w.id === weekId
                    ? { ...w, items: [...w.items, { type: "post" as const, id: post.id }] }
                    : w
            );
            const updated = await saveProgram({ ...program, weeks: updatedWeeks });

            toast.success("게시물이 추가되었습니다.");
            setOpen(false);
            setTitle("");
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "게시물 추가에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <Plus />
                게시물 추가
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>게시물 추가</DialogTitle>
                    <DialogDescription>이 주차에 추가할 게시물 제목을 입력하세요.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="post-title">게시물 제목 *</Label>
                        <Input
                            id="post-title"
                            placeholder="게시물 제목을 입력하세요"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd();
                            }}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" size="sm" disabled={loading} />}>
                        취소
                    </DialogClose>
                    <Button size="sm" onClick={handleAdd} disabled={loading}>
                        <Plus className="size-4" />
                        {loading ? "추가 중..." : "추가하기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
