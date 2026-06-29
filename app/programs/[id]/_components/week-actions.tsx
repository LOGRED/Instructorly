/**
 * 주차 관리 액션 메뉴 — 주차 이름 변경과 삭제를 드롭다운 + 확인 다이얼로그로 처리한다.
 */
"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveProgram } from "@/lib/api";
import type { Program, Week } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WeekActionsProps {
    program: Program;
    week: Week;
    onSaved: (updated: Program) => void;
}

/** 기본 제목("N주차") 여부 — 삭제 후 재정렬 시 자동 제목만 갱신 */
function isDefaultTitle(week: Week): boolean {
    return week.title.trim() === `${week.weekNo}주차`;
}

/** 삭제 후 남은 주차의 weekNo를 1..n으로 다시 매기고, 자동 제목은 함께 갱신 */
function renumber(weeks: Week[]): Week[] {
    return weeks.map((w, idx) => {
        const newNo = idx + 1;
        return {
            ...w,
            weekNo: newNo,
            title: isDefaultTitle(w) ? `${newNo}주차` : w.title,
        };
    });
}

export function WeekActions({ program, week, onSaved }: WeekActionsProps) {
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [title, setTitle] = useState(week.title);
    const [busy, setBusy] = useState(false);

    function openRename() {
        setTitle(week.title);
        setRenameOpen(true);
    }

    async function handleRename() {
        const next = title.trim();
        if (!next) {
            toast.error("주차 이름을 입력해 주세요.");
            return;
        }
        if (next === week.title) {
            setRenameOpen(false);
            return;
        }
        setBusy(true);
        try {
            const updatedWeeks = program.weeks.map((w) =>
                w.id === week.id ? { ...w, title: next } : w
            );
            const updated = await saveProgram({ ...program, weeks: updatedWeeks });
            toast.success("주차 이름이 변경되었습니다.");
            setRenameOpen(false);
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "이름 변경에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete() {
        setBusy(true);
        try {
            const remaining = program.weeks.filter((w) => w.id !== week.id);
            const updated = await saveProgram({
                ...program,
                weeks: renumber(remaining),
            });
            toast.success("주차가 삭제되었습니다.");
            setDeleteOpen(false);
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "주차 삭제에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    const itemCount = week.items.length;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label="주차 관리" />}
                >
                    <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openRename}>
                        <Pencil />
                        이름 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 />
                        주차 삭제
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* 이름 변경 */}
            <Dialog open={renameOpen} onOpenChange={(o) => !busy && setRenameOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>주차 이름 변경</DialogTitle>
                        <DialogDescription>
                            {week.weekNo}주차의 이름을 변경합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="week-title">주차 이름 *</Label>
                        <Input
                            id="week-title"
                            placeholder="예: 1주차 - 오리엔테이션"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={busy}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename();
                            }}
                        />
                    </div>

                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" disabled={busy} />}>
                            취소
                        </DialogClose>
                        <Button onClick={handleRename} disabled={busy}>
                            {busy ? "저장 중..." : "저장하기"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 삭제 확인 */}
            <Dialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>주차 삭제</DialogTitle>
                        <DialogDescription>
                            {week.weekNo}주차를 삭제하시겠습니까?
                            {itemCount > 0
                                ? ` 이 주차의 항목 ${itemCount}개도 목록에서 제거됩니다.`
                                : ""}
                            {" 이 작업은 되돌릴 수 없습니다."}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" disabled={busy} />}>
                            취소
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                            {busy ? "삭제 중..." : "삭제하기"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
