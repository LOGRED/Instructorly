/**
 * 초대 링크 진입점 — /join/{초대코드}
 * 로그인 확인 → enrollByInvite → 해당 강좌로 이동.
 * 비로그인 시 로그인 페이지로 보낸 뒤 이 링크로 복귀(`?next=`).
 */
"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinByInvite } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { Skeleton } from "@/components/ui/skeleton";

export default function JoinByCodePage() {
    const { code } = useParams<{ code: string }>();
    const router = useRouter();

    const userId = useIdentity((s) => s.userId);
    const hydrated = useIdentity((s) => s.hydrated);

    // 자동 참여는 한 번만 실행
    const handled = useRef(false);

    useEffect(() => {
        if (!hydrated || handled.current) return;
        handled.current = true;

        // 비로그인 → 로그인 후 이 링크로 복귀
        if (!userId) {
            router.replace(`/login?next=/join/${encodeURIComponent(code)}`);
            return;
        }

        // 로그인 상태 → 초대 코드로 자동 참여
        (async () => {
            try {
                const program = await joinByInvite(code, userId);
                toast.success(`'${program.title}' 강좌에 참여했습니다.`);
                router.replace(`/programs/${program.id}`);
            } catch (err) {
                toast.error(
                    err instanceof Error ? err.message : "초대 코드에 해당하는 강좌가 없습니다.",
                );
                router.replace("/programs");
            }
        })();
    }, [hydrated, userId, code, router]);

    return (
        <main className="min-h-screen grid place-items-center p-4">
            <div className="flex flex-col items-center gap-4 text-center">
                <Skeleton className="size-10 rounded-full" />
                <p className="text-muted-foreground">강좌에 참여하는 중…</p>
            </div>
        </main>
    );
}
