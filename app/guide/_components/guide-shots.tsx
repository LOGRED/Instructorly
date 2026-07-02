/**
 * 기능 설명용 화면 사진(스크린샷) 묶음 — 실제 화면을 그대로 찍은 사진을 큼직하게 보여 준다.
 * 글로만 설명하면 어디를 눌러야 할지 헷갈리는 어르신을 위해, 단계 설명 바로 아래에서
 * '진짜 화면'을 보여 주는 역할이다. 사진을 아직 못 불러오면 그 자리만 조용히 숨긴다.
 */
"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import type { GuideShot } from "./guide-data";

// 사진 한 장(이미지 + 그 아래 설명). 못 불러오면(파일 없음 등) 숨긴다.
function Shot({ shot }: { shot: GuideShot }) {
    const [ok, setOk] = useState(true);
    if (!ok) {
        return null;
    }
    return (
        <figure className="m-0">
            <img
                src={shot.src}
                alt={shot.caption}
                loading="lazy"
                onError={() => setOk(false)}
                className="w-full rounded-2xl border shadow-sm ring-1 ring-border/50"
            />
            <figcaption className="mt-2 text-base leading-relaxed text-muted-foreground">
                {shot.caption}
            </figcaption>
        </figure>
    );
}

// 한 기능의 화면 사진들을 모아 그린다. 사진이 없으면 아무것도 그리지 않는다.
export function GuideShots({ shots }: { shots?: GuideShot[] }) {
    if (!shots || shots.length === 0) {
        return null;
    }
    return (
        <section aria-label="실제 화면 사진">
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <Camera className="size-5 text-muted-foreground" />
                <span>실제 화면 사진</span>
            </div>
            <div className="space-y-5">
                {shots.map((shot, i) => (
                    <Shot key={i} shot={shot} />
                ))}
            </div>
        </section>
    );
}
