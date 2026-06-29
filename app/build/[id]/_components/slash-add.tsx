/**
 * 노션식 추가 줄 — 텍스트 입력 후 Enter로 문단 추가, "/" 입력 시 블럭 메뉴를 연다.
 * 미디어 생성·업로드가 별도 항목이라 선택 시 type과 mode를 함께 넘긴다.
 */
"use client";

import { useState } from "react";
import { Slash } from "lucide-react";
import { BLOCK_META, type BlockMeta, type BlockMode } from "@/lib/blocks";
import type { BlockType } from "@/lib/types";
import { MetaIcon } from "@/components/blocks/block-icon";

export function SlashAdd({
    onAdd,
    onAddText,
}: {
    onAdd: (t: BlockType, mode?: BlockMode) => void;
    onAddText: (text: string) => void;
}) {
    const [value, setValue] = useState("");
    const [open, setOpen] = useState(false);

    const isCommand = value.startsWith("/");
    const query = isCommand ? value.slice(1).toLowerCase() : "";
    const filtered = BLOCK_META.filter(
        (m) =>
            !query ||
            m.label.toLowerCase().includes(query) ||
            m.keywords.some((k) => k.toLowerCase().includes(query)),
    );

    // 메뉴에서 블럭을 골라 추가한다.
    function choose(meta: BlockMeta) {
        onAdd(meta.type, meta.mode);
        setValue("");
        setOpen(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !isCommand) {
            e.preventDefault();
            const text = value.trim();
            if (text) {
                onAddText(text);
                setValue("");
            }
        } else if (e.key === "Enter" && isCommand && filtered.length > 0) {
            e.preventDefault();
            choose(filtered[0]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-muted-foreground focus-within:border-solid focus-within:border-ring">
                <Slash className="size-4 shrink-0" />
                <input
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setOpen(e.target.value.startsWith("/"));
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setOpen(value.startsWith("/"))}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="여기에 입력하고 Enter, 또는 '/' 를 눌러 블럭 추가"
                    className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                    aria-label="블럭 추가 입력"
                />
            </div>

            {open && (
                <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-md ring-1 ring-foreground/10">
                    {filtered.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">일치하는 블럭이 없어요</p>
                    ) : (
                        filtered.map((m) => (
                            <button
                                key={m.key}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(m)}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                                    <MetaIcon name={m.icon} className="size-4" />
                                </span>
                                <span>
                                    <span className="block text-sm font-medium text-foreground">
                                        {m.label}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        {m.hint}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
