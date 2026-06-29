/**
 * 새 강좌 만들기 다이얼로그 — 제목·설명에 더해 강좌 시작일/종료일과 매주 수업
 * 요일을 입력받고, 선택값에 맞춰 "1주차"에 실제로 수업하는 날짜를 실시간 미리보기로
 * 보여주는 클라이언트 컴포넌트.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createProgram } from "@/lib/api";
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

interface CreateProgramDialogProps {
    ownerId: string;
    ownerName: string;
    onCreated?: () => void;
}

// 새 강좌 만들기 다이얼로그 컴포넌트.
export function CreateProgramDialog({
    ownerId,
    ownerName,
    onCreated,
}: CreateProgramDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [weekDays, setWeekDays] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // 다이얼로그가 닫힐 때 입력값을 모두 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) {
            setTitle("");
            setDescription("");
            setStartDate("");
            setEndDate("");
            setWeekDays([]);
        }
    }

    // 입력값으로 강좌를 생성하고 상세 페이지로 이동한다.
    async function handleCreate() {
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
            const program = await createProgram({
                title: title.trim(),
                description: description.trim(),
                ownerId,
                ownerName,
                startDate: startDate || null,
                endDate: endDate || null,
                weekDays,
            });
            toast.success("강좌가 만들어졌습니다.");
            handleOpenChange(false);
            onCreated?.();
            router.push(`/programs/${program.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "강좌 생성에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="lg" />}>
                <Plus />
                새 강좌 만들기
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>새 강좌 만들기</DialogTitle>
                    <DialogDescription>
                        강좌 제목·설명과 수업 기간·요일을 입력하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="program-title">제목 *</Label>
                        <Input
                            id="program-title"
                            placeholder="강좌 제목을 입력하세요"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="program-description">설명</Label>
                        <Textarea
                            id="program-description"
                            placeholder="강좌에 대한 간단한 설명을 입력하세요 (선택)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={loading}
                            rows={3}
                        />
                    </div>

                    <ScheduleFields
                        idPrefix="create-program"
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
                    <Button size="lg" onClick={handleCreate} disabled={loading}>
                        {loading ? "만드는 중..." : "만들기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
