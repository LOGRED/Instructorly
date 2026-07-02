/**
 * 창작 실습 페이지 — 강사는 시범본(sample)을, 학습자는 자기 작품(work)을 만드는
 * 에디터를 띄운다. 신원(역할)을 보고 무엇을 편집할지 정한 뒤 에디터에 넘긴다.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { getAtelier, getAtelierWork } from "@/lib/api";
import type { Atelier, AtelierDoc } from "@/lib/types";
import { useIdentity } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { AtelierEditor } from "./_components/atelier-editor";

export default function AtelierPage() {
    const { id } = useParams<{ id: string }>();
    const role = useIdentity((s) => s.role);
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const hydrated = useIdentity((s) => s.hydrated);

    const [atelier, setAtelier] = useState<Atelier | null>(null);
    const [initialDoc, setInitialDoc] = useState<AtelierDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hydrated) return;
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const a = await getAtelier(id);
                if (!alive) return;
                setAtelier(a);
                // 강사는 시범본을, 학생은 자기 작품을 불러온다(없으면 null → 시작 화면).
                if (role === "instructor") {
                    setInitialDoc(a.sample);
                } else if (userId) {
                    const work = await getAtelierWork(id, userId);
                    if (!alive) return;
                    setInitialDoc(work?.doc ?? null);
                } else {
                    setInitialDoc(null);
                }
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, hydrated, role, userId]);

    if (loading || !hydrated) {
        return (
            <div className="grid h-screen place-items-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-8 animate-spin" />
                    <p>불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error || !atelier) {
        return (
            <div className="grid h-screen place-items-center p-6 text-center">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-muted-foreground">{error ?? "창작 실습을 찾을 수 없습니다."}</p>
                    <Button variant="outline" render={<Link href="/programs" />}>
                        강좌 목록으로
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <AtelierEditor
            atelier={atelier}
            role={role ?? "student"}
            userId={userId ?? ""}
            userName={nickname ?? "사용자"}
            initialDoc={initialDoc}
        />
    );
}
