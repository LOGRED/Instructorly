/**
 * 강의 학습 페이지 — 강의 플레이어를 로드하고 학습자 세션을 초기화하는 클라이언트 컴포넌트.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Course } from "@/lib/types";
import { getCourse } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Player } from "./_components/player";

/** useSearchParams()는 Suspense 경계 안에서만 안전하게 호출 가능. */
function LearnPageInner() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const searchParams = useSearchParams();
    const programId = searchParams.get("program");

    const { userId, role, hydrated } = useIdentity();

    const [course, setCourse] = useState<Course | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getCourse(id)
            .then((c) => active && setCourse(c))
            .catch((e: unknown) =>
                active && setError(e instanceof Error ? e.message : "불러오기 실패"),
            );
        return () => {
            active = false;
        };
    }, [id]);

    if (error) {
        return (
            <div className="grid min-h-screen place-items-center p-6 text-center">
                <div className="space-y-4">
                    <p className="text-lg font-medium">강의를 불러오지 못했어요</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button render={<Link href={programId ? `/programs/${programId}` : "/programs"} />}>
                        {programId ? "강좌로 돌아가기" : "강좌 목록으로"}
                    </Button>
                </div>
            </div>
        );
    }

    // identity hydration 또는 강의 로딩 대기
    if (!course || !hydrated) {
        return (
            <div className="grid min-h-screen place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Player
            initial={course}
            userId={userId}
            role={role}
            programId={programId}
        />
    );
}

export default function LearnPage() {
    return (
        <Suspense
            fallback={
                <div className="grid min-h-screen place-items-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <LearnPageInner />
        </Suspense>
    );
}
