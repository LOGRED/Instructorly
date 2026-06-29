/**
 * 강좌 정보 수정 다이얼로그 — 제목·설명에 더해 수업 기간(시작일/종료일)과 매주
 * 수업 요일을 수정하고, 1주차 수업 날짜를 실시간 미리보기로 보여주는 클라이언트
 * 컴포넌트.
 */
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateProgram } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScheduleFields } from "./schedule-fields";

interface EditProgramDialogProps {
    programId: string;
    initialTitle: string;
    initialDescription: string;
    initialStartDate?: string | null;
    initialEndDate?: string | null;
    initialWeekDays?: number[];
    /** true: icon-only button (list card), false: labelled button (detail header). */
    compact?: boolean;
    onSaved?: (updated: Program) => void;
}

// 강좌 정보 수정 다이얼로그 컴포넌트.
export function EditProgramDialog({
    programId,
    initialTitle,
    initialDescription,
    initialStartDate = null,
    initialEndDate = null,
    initialWeekDays = [],
    compact = false,
    onSaved,
}: EditProgramDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [startDate, setStartDate] = useState(initialStartDate ?? "");
    const [endDate, setEndDate] = useState(initialEndDate ?? "");
    const [weekDays, setWeekDays] = useState<number[]>(initialWeekDays);
    const [loading, setLoading] = useState(false);

    // 다이얼로그가 열릴 때마다 최신 props 값으로 폼을 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (next) {
            setTitle(initialTitle);
            setDescription(initialDescription);
            setStartDate(initialStartDate ?? "");
            setEndDate(initialEndDate ?? "");
            setWeekDays(initialWeekDays);
        }
    }

    // 수정한 제목·설명·일정을 저장한다.
    async function handleSave() {
        if (!title.trim()) {
            toast.error("강좌 제목을 입력해 주세요.");
            return;
        }
        if (startDate && endDate && endDate < startDate) {
            toast.error("종료일은 시작일보다 빠를 수 없습니다.");
            return;
        }
        setLoading(true);
        try {
            const updated = await updateProgram(programId, {
                title: title.trim(),
                description: description.trim(),
                startDate: startDate || null,
                endDate: endDate || null,
                weekDays,
            });
            toast.success("강좌 정보가 수정되었습니다.");
            setOpen(false);
            onSaved?.(updated);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "강좌 수정에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    compact ? (
                        <Button variant="ghost" size="icon-lg" aria-label="강좌 정보 수정" />
                    ) : (
                        <Button variant="outline" size="lg" />
                    )
                }
            >
                <Pencil />
                {!compact && "강좌 정보 수정"}
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>강좌 정보 수정</DialogTitle>
                    <DialogDescription>
                        강좌 제목·설명과 수업 기간·요일을 수정하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-program-title">제목 *</Label>
                        <Input
                            id="edit-program-title"
                            placeholder="강좌 제목을 입력하세요"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-program-description">설명</Label>
                        <Textarea
                            id="edit-program-description"
                            placeholder="강좌에 대한 간단한 설명을 입력하세요 (선택)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={loading}
                            rows={3}
                        />
                    </div>

                    <ScheduleFields
                        idPrefix="edit-program"
                        startDate={startDate}
                        endDate={endDate}
                        weekDays={weekDays}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        onWeekDaysChange={setWeekDays}
                        disabled={loading}
                    />
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" size="lg" disabled={loading} />}>
                        취소
                    </DialogClose>
                    <Button size="lg" onClick={handleSave} disabled={loading}>
                        {loading ? "저장 중..." : "저장"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
