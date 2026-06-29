/**
 * 시험·연습 실행 페이지 — 실제 LLM 사이트를 흉내 낸 화면을 전체 화면으로 띄운다.
 * 사이트 헤더 없이 클론이 화면을 꽉 채우도록 하고, 드릴을 불러와 런너에 넘긴다.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { getDrill } from "@/lib/api";
import type { Drill } from "@/lib/types";
import { useIdentity } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { DrillRunner } from "./_components/drill-runner";

export default function DrillPage() {
    const { id } = useParams<{ id: string }>();
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const hydrated = useIdentity((s) => s.hydrated);

    const [drill, setDrill] = useState<Drill | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        getDrill(id)
            .then((d) => {
                if (alive) setDrill(d);
            })
            .catch((e) => {
                if (alive) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [id]);

    if (loading || !hydrated) {
        return (
            <div className="grid h-screen place-items-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    <p>불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error || !drill) {
        return (
            <div className="grid h-screen place-items-center p-6 text-center">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-muted-foreground">{error ?? "시험/연습을 찾을 수 없습니다."}</p>
                    <Button variant="outline" render={<Link href="/programs" />}>
                        강좌 목록으로
                    </Button>
                </div>
            </div>
        );
    }

    return <DrillRunner drill={drill} userName={nickname ?? "사용자"} userId={userId ?? ""} />;
}
