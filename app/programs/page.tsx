/**
 * 강좌 목록 페이지 — 강좌실 전체 강좌를 그리드로 나열하고, 강사에게는 새 강좌 만들기 버튼, 학생에게는 초대 코드 참여 버튼을 제공한다.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

import { listPrograms } from "@/lib/api";
import type { ProgramSummary } from "@/lib/types";
import { useIdentity } from "@/lib/identity";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramCard } from "./_components/program-card";
import { CreateProgramDialog } from "./_components/create-program-dialog";
import { JoinByInvite } from "./_components/join-by-invite";

// 강좌 목록 페이지 컴포넌트.
export default function ProgramsPage() {
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const role = useIdentity((s) => s.role);
    const hydrated = useIdentity((s) => s.hydrated);

    const [programs, setPrograms] = useState<ProgramSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // 강좌 목록을 서버에서 불러와 상태에 반영한다.
    const load = useCallback(async () => {
        if (!hydrated || !userId || !role) return;
        setLoading(true);
        try {
            const params =
                role === "instructor"
                    ? { role: "instructor" as const, ownerId: userId }
                    : { role: "student" as const, userId };
            const data = await listPrograms(params);
            setPrograms(data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "강좌 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [hydrated, userId, role]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <>
            <SiteHeader />

            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
                {/* 페이지 헤더 */}
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="eyebrow">강좌실</span>
                        <h1 className="text-3xl font-bold">강좌 목록</h1>
                    </div>

                    <div className="flex gap-2">
                        {hydrated && role === "instructor" && userId && nickname && (
                            <CreateProgramDialog
                                ownerId={userId}
                                ownerName={nickname}
                                onCreated={load}
                            />
                        )}
                        {hydrated && role === "student" && userId && (
                            <JoinByInvite userId={userId} onJoined={load} />
                        )}
                    </div>
                </div>

                {/* 로딩 스켈레톤 */}
                {loading && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="rounded-xl h-52" />
                        ))}
                    </div>
                )}

                {/* 빈 상태 */}
                {!loading && programs.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed py-20 text-center">
                        <p className="text-lg text-muted-foreground">
                            {role === "instructor"
                                ? "아직 만든 강좌가 없습니다."
                                : "수강 중인 강좌가 없습니다."}
                        </p>
                        {hydrated && role === "instructor" && userId && nickname && (
                            <CreateProgramDialog
                                ownerId={userId}
                                ownerName={nickname}
                                onCreated={load}
                            />
                        )}
                        {hydrated && role === "student" && userId && (
                            <JoinByInvite userId={userId} onJoined={load} />
                        )}
                    </div>
                )}

                {/* 강좌 그리드 */}
                {!loading && programs.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {programs.map((program) => (
                            <ProgramCard
                                key={program.id}
                                program={program}
                                role={role}
                                onChanged={load}
                            />
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
