/**
 * 강의 빌더 진입 페이지 — URL의 강의 ID로 데이터를 불러와 Builder 컴포넌트에 넘긴다.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Course } from "@/lib/types";
import { getCourse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Builder } from "./_components/builder";

export default function BuildPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;
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
                    <Button render={<Link href="/programs" />}>강좌 목록으로</Button>
                </div>
            </div>
        );
    }

    if (!course) {
        return (
            <div className="grid min-h-screen place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return <Builder initial={course} />;
}
