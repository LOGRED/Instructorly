/**
 * 블럭 모드 토글 — 미디어 블럭(이미지·동영상·오디오) 헤더에서 [업로드 | AI 생성]을
 * 전환하는 강사 전용 세그먼트 컨트롤. 같은 블럭이 업로드와 AI 생성을 모두 지원하도록
 * mode 필드만 바꿔 끼운다(생성·업로드 UI는 카드가 mode에 따라 이미 분기해 그린다).
 */
"use client";

import type { BlockMode } from "@/lib/blocks";
import { cn } from "@/lib/utils";

/** [업로드 | AI 생성] 세그먼트 토글을 그린다. value=현재 모드, onChange=선택 모드 전달. */
export function BlockModeToggle({
    value,
    onChange,
}: {
    value: BlockMode;
    onChange: (mode: BlockMode) => void;
}) {
    const options: { mode: BlockMode; label: string }[] = [
        { mode: "upload", label: "업로드" },
        { mode: "gen", label: "AI 생성" },
    ];
    return (
        <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
            {options.map((o) => (
                <button
                    key={o.mode}
                    type="button"
                    onClick={() => onChange(o.mode)}
                    className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-colors",
                        value === o.mode
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
