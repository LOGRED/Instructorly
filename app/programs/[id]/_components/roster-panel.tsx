/**
 * 수강생 명단 패널 — 수강생 목록과 각 학생의 강의 진행률을 표시하고, 내보내기(등록 취소)를 지원한다.
 */
"use client";

import { useState } from "react";
import { ChevronRight, UserMinus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { unenrollStudent } from "@/lib/api";
import { avatarSrc } from "@/lib/avatars";
import type { Enrollment, LessonProgress } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

interface RosterPanelProps {
    programId: string;
    enrollments: Enrollment[];
    progress: LessonProgress[];
    totalLessonCount: number;
    onChanged: () => void;
}

// 내보내기 확인 다이얼로그 상태 타입
interface ConfirmState {
    userId: string;
    name: string;
}

export function RosterPanel({
    programId,
    enrollments,
    progress,
    totalLessonCount,
    onChanged,
}: RosterPanelProps) {
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [busy, setBusy] = useState(false);

    // 내보내기 확인 다이얼로그를 연다.
    function openConfirm(userId: string, name: string) {
        setConfirm({ userId, name });
    }

    // 확인 다이얼로그를 닫는다(작업 중에는 닫지 않는다).
    function handleDialogChange(open: boolean) {
        if (busy) return;
        if (!open) setConfirm(null);
    }

    // 수강생을 강좌에서 내보낸다.
    async function handleUnenroll() {
        if (!confirm) return;
        setBusy(true);
        try {
            await unenrollStudent(programId, confirm.userId);
            toast.success(`${confirm.name}님이 내보내졌습니다.`);
            setConfirm(null);
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "내보내기에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    if (enrollments.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4 text-center">
                등록된 수강생이 없습니다.
            </p>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                {enrollments.map((enrollment) => {
                    const userProgress = progress.filter(
                        (p) => p.userId === enrollment.userId
                    );
                    const completedCount = userProgress.filter((p) => p.completed).length;
                    const pct =
                        totalLessonCount > 0
                            ? Math.round((completedCount / totalLessonCount) * 100)
                            : 0;

                    const enrolledDate = new Date(enrollment.enrolledAt).toLocaleDateString("ko-KR");

                    return (
                        <div
                            key={enrollment.userId}
                            className="relative flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
                        >
                            {/* 행 전체를 클릭하면 수강생 크레딧 대시보드로 이동 */}
                            <Link
                                href={`/programs/${programId}/students/${enrollment.userId}`}
                                className="absolute inset-0 rounded-lg"
                                aria-label={`${enrollment.name} 크레딧 대시보드 보기`}
                            />
                            <Avatar size="default" className="shrink-0">
                                {avatarSrc(enrollment.avatar) && (
                                    <AvatarImage src={avatarSrc(enrollment.avatar)!} alt="" />
                                )}
                                <AvatarFallback>
                                    {enrollment.name ? enrollment.name.charAt(0) : "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="font-medium">{enrollment.name}</span>
                                    <span className="mono text-xs text-muted-foreground">
                                        @{enrollment.userId}
                                    </span>
                                    <span className="mono text-xs text-muted-foreground ml-auto">
                                        등록일 {enrolledDate}
                                    </span>
                                </div>
                                <Progress value={pct} className="gap-1.5">
                                    <ProgressLabel className="text-xs text-muted-foreground">
                                        {completedCount}/{totalLessonCount}강의 완료
                                    </ProgressLabel>
                                    <ProgressValue className="text-xs">{() => `${pct}%`}</ProgressValue>
                                </Progress>
                            </div>

                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />

                            {/* 내보내기 버튼은 Link 위에 z-index 로 올려 클릭 분리 */}
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="relative z-10"
                                onClick={(e) => {
                                    e.preventDefault();
                                    openConfirm(enrollment.userId, enrollment.name);
                                }}
                                aria-label={`${enrollment.name} 내보내기`}
                            >
                                <UserMinus className="size-4 text-destructive" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            {/* 내보내기 확인 다이얼로그 */}
            <Dialog open={!!confirm} onOpenChange={handleDialogChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>수강생 내보내기</DialogTitle>
                        <DialogDescription>
                            {confirm?.name}님을 강좌에서 내보낼까요? 수강 기록은 유지되지만 더 이상 강좌에 접근할 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" disabled={busy} />}>
                            취소
                        </DialogClose>
                        <Button variant="destructive" onClick={handleUnenroll} disabled={busy}>
                            {busy ? "처리 중..." : "내보내기"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
