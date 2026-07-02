/**
 * 주차 항목 액션 메뉴 — 강의/게시물/공지 한 항목의 "..." 더보기 메뉴.
 * 강사에게만 노출되며, 편집(해당 편집 화면으로 이동)과 삭제(확인 후 제거)를 한곳에 모은다.
 * 삭제는 주차 목록에서 항목을 빼 프로그램을 저장한 뒤, 원본 콘텐츠(강의/게시물/공지)까지 지운다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
    saveProgram,
    deleteCourse,
    deletePost,
    deleteAnnouncement,
    deleteDrill,
    deleteAtelier,
} from "@/lib/api";
import type { Program, WeekItem, WeekItemType } from "@/lib/types";
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

interface ItemActionsProps {
    program: Program;
    weekId: string;
    item: WeekItem;
    title: string;
    /** 편집 화면 경로. 시험·연습처럼 편집 화면이 없는 항목은 생략한다. */
    editHref?: string;
    onSaved: (updated: Program) => void;
}

/** 항목 종류별 한글 이름 — 토스트/삭제 안내 문구에 사용. */
const TYPE_LABEL: Record<WeekItemType, string> = {
    lesson: "강의",
    post: "게시물",
    announcement: "공지사항",
    exam: "시험",
    practice: "연습",
    atelier: "실습",
};

export function ItemActions({
    program,
    weekId,
    item,
    title,
    editHref,
    onSaved,
}: ItemActionsProps) {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const label = TYPE_LABEL[item.type];

    // 항목을 주차에서 빼 프로그램을 저장하고, 원본 콘텐츠까지 삭제한다.
    async function handleDelete() {
        setBusy(true);
        try {
            const updatedWeeks = program.weeks.map((w) =>
                w.id === weekId
                    ? { ...w, items: w.items.filter((i) => i.id !== item.id) }
                    : w,
            );
            const updated = await saveProgram({ ...program, weeks: updatedWeeks });

            // 주차 목록에서 빠진 뒤, 더 이상 참조되지 않는 원본 콘텐츠를 정리한다.
            if (item.type === "lesson") await deleteCourse(item.id);
            else if (item.type === "post") await deletePost(item.id);
            else if (item.type === "announcement") await deleteAnnouncement(item.id);
            else if (item.type === "atelier") await deleteAtelier(item.id);
            else await deleteDrill(item.id);

            toast.success(`${label}이(가) 삭제되었습니다.`);
            setDeleteOpen(false);
            onSaved(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `${label} 삭제에 실패했습니다.`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={`${label} 관리`} />}
                >
                    <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {editHref && (
                        <DropdownMenuItem render={<Link href={editHref} />}>
                            <Pencil />
                            편집
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 />
                        삭제
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* 삭제 확인 */}
            <Dialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{label} 삭제</DialogTitle>
                        <DialogDescription>
                            &ldquo;{title}&rdquo; {label}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
