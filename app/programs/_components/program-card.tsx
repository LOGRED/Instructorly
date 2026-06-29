/**
 * 강좌 카드 — 강좌 목록 그리드의 개별 카드로, 제목·설명·운영자·배지·일정·수정일을 표시하고 보기/편집/삭제 액션을 제공한다.
 */
"use client";

import Link from "next/link";
import { Trash2, BookOpen, Users, CalendarDays, User } from "lucide-react";
import { toast } from "sonner";

import { deleteProgram } from "@/lib/api";
import type { ProgramSummary, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditProgramDialog } from "./edit-program-dialog";
import { ProgramSchedule } from "./program-schedule";

interface ProgramCardProps {
    program: ProgramSummary;
    role: Role | null;
    /** 강좌가 삭제되거나 정보가 수정된 뒤 호출된다. */
    onChanged: () => void;
}

// 강좌 카드 컴포넌트 — 강좌 정보를 카드 형태로 렌더링한다.
export function ProgramCard({ program, role, onChanged }: ProgramCardProps) {
    const date = new Date(program.updatedAt).toLocaleDateString("ko-KR");

    // 강좌를 삭제하고 목록을 갱신한다.
    async function handleDelete() {
        if (!window.confirm("이 강좌를 삭제할까요?")) return;
        try {
            await deleteProgram(program.id);
            toast.success("강좌가 삭제되었습니다.");
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "삭제에 실패했습니다.");
        }
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="line-clamp-1 text-lg">{program.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                    {program.description || "설명 없음"}
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-3">
                <span className="eyebrow inline-flex items-center gap-1">
                    <User className="size-3" />
                    {program.ownerName}
                </span>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                        <CalendarDays className="size-3" />
                        {program.weekCount}주차
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                        <BookOpen className="size-3" />
                        {program.lessonCount}강의
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                        <Users className="size-3" />
                        {program.studentCount}명
                    </Badge>
                </div>

                <ProgramSchedule
                    compact
                    startDate={program.startDate}
                    endDate={program.endDate}
                    weekDays={program.weekDays}
                />

                <span className="mono text-muted-foreground text-xs">{date}</span>
            </CardContent>

            <CardFooter className="gap-2">
                <Button
                    size="lg"
                    className="flex-1"
                    render={<Link href={`/programs/${program.id}`} />}
                >
                    강좌 보기
                </Button>

                {role === "instructor" && (
                    <>
                        <EditProgramDialog
                            compact
                            programId={program.id}
                            initialTitle={program.title}
                            initialDescription={program.description}
                            initialStartDate={program.startDate}
                            initialEndDate={program.endDate}
                            initialWeekDays={program.weekDays}
                            onSaved={onChanged}
                        />
                        <Button
                            variant="ghost"
                            size="icon-lg"
                            onClick={handleDelete}
                            aria-label="강좌 삭제"
                        >
                            <Trash2 />
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
