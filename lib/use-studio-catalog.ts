/**
 * 스튜디오 모델 카탈로그 공유 훅 — 여러 블럭 카드가 동시에 써도 네트워크 호출은 한 번만
 * 일어나도록 모듈 레벨로 캐시한다(가격표·환율·키 보유 여부 포함).
 */
"use client";

import { useEffect, useState } from "react";
import { getStudioCatalog } from "./api";
import type { StudioCatalog } from "./types";

let cache: StudioCatalog | null = null;
let inflight: Promise<StudioCatalog> | null = null;

/** 카탈로그를 한 번만 받아 공유한다. {catalog, loading, error} 반환. */
export function useStudioCatalog(): {
    catalog: StudioCatalog | null;
    loading: boolean;
    error: string | null;
} {
    const [catalog, setCatalog] = useState<StudioCatalog | null>(cache);
    const [loading, setLoading] = useState(!cache);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (cache) {
            setCatalog(cache);
            setLoading(false);
            return;
        }
        let alive = true;
        if (!inflight) {
            inflight = getStudioCatalog()
                .then((c) => {
                    cache = c;
                    return c;
                })
                .finally(() => {
                    inflight = null;
                });
        }
        inflight
            .then((c) => {
                if (alive) {
                    setCatalog(c);
                    setLoading(false);
                }
            })
            .catch((e) => {
                if (alive) {
                    setError(e instanceof Error ? e.message : "모델 목록을 불러오지 못했습니다.");
                    setLoading(false);
                }
            });
        return () => {
            alive = false;
        };
    }, []);

    return { catalog, loading, error };
}
