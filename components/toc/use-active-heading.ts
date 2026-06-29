/**
 * 스크롤 위치에 따라 (1) 현재 화면 상단에 걸린 헤딩의 DOM id와 (2) 전체 읽기 진행률(0~1)을
 * 함께 추적하는 스크롤스파이 훅. window 스크롤(글·공지)과 내부 스크롤 컨테이너(강의
 * #lecture-scroll)를 모두 지원한다. requestAnimationFrame에 의존하지 않고 스크롤 이벤트에서
 * 바로 계산해, 백그라운드 탭·임베드 웹뷰처럼 rAF가 throttle되는 환경에서도 동작한다.
 */
"use client";

import { useEffect, useState } from "react";

export interface ReadingState {
    /** 현재 활성(상단에 걸린) 헤딩의 DOM id. 없으면 "". */
    activeId: string;
    /** 전체 스크롤 진행률 0~1. 콘텐츠가 한 화면에 다 들어오면 1로 본다. */
    progress: number;
}

// 헤딩 id 목록과(선택) 내부 스크롤 컨테이너 id를 받아 활성 헤딩 + 읽기 진행률을 반환한다.
export function useActiveHeading(ids: string[], scrollRootId?: string): ReadingState {
    const [state, setState] = useState<ReadingState>({ activeId: "", progress: 0 });

    useEffect(() => {
        if (ids.length === 0) {
            setState({ activeId: "", progress: 0 });
            return;
        }
        const root = scrollRootId ? document.getElementById(scrollRootId) : null;
        const target: EventTarget = root ?? window;
        let cancelled = false;

        // 상단 기준선보다 위에 있는 마지막 헤딩을 활성으로 보고, 전체 스크롤 진행률을 계산한다.
        function compute() {
            if (cancelled) return; // 정리(cleanup) 후에는 상태를 갱신하지 않는다.
            const rootTop = root ? root.getBoundingClientRect().top : 0;
            const line = rootTop + 120;
            let current = ids[0];
            for (const id of ids) {
                const el = document.getElementById(id);
                if (!el) continue;
                if (el.getBoundingClientRect().top <= line) current = id;
                else break;
            }

            let progress = 1;
            if (root) {
                const max = root.scrollHeight - root.clientHeight;
                progress = max > 0 ? root.scrollTop / max : 1;
            } else {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                progress = max > 0 ? window.scrollY / max : 1;
            }
            progress = Math.min(1, Math.max(0, progress));

            // 활성 id가 같고 진행률 변화가 미미하면 리렌더를 건너뛴다.
            setState((prev) =>
                prev.activeId === current && Math.abs(prev.progress - progress) < 0.004
                    ? prev
                    : { activeId: current, progress },
            );
        }

        compute();
        target.addEventListener("scroll", compute, { passive: true });
        window.addEventListener("resize", compute, { passive: true });

        return () => {
            cancelled = true;
            target.removeEventListener("scroll", compute);
            window.removeEventListener("resize", compute);
        };
    }, [ids.join("|"), scrollRootId]);

    return state;
}
