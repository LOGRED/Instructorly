/**
 * 링크 북마크 블럭 카드 — URL을 노션 스타일 미리보기 카드로 보여 준다.
 * `authoring=true`(빌더): URL 입력 + "불러오기"로 Open Graph 메타를 긁어 카드를 채운다.
 * `authoring=false`(학습자): 카드를 클릭하면 새 탭으로 링크를 연다(읽기 전용).
 * 메타가 비어도(긁기 실패) 호스트명만으로 최소 카드를 그린다.
 */
"use client";

import { useState } from "react";
import { Link as LinkIcon, Loader2, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import type { BookmarkBlock } from "@/lib/types";
import { fetchLinkPreview } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** URL에서 표시용 호스트명만 뽑는다(www 제거). 파싱 실패하면 원본을 돌려준다. */
function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

// 링크 북마크 블럭 카드를 렌더한다.
export function BookmarkBlockCard({
    block,
    onChange,
    authoring = true,
    autoFocus,
}: {
    block: BookmarkBlock;
    onChange: (b: BookmarkBlock) => void;
    /** 빌더(작성자)면 true — URL 입력·메타 불러오기 노출. 학습자면 false — 클릭 가능한 카드만. */
    authoring?: boolean;
    autoFocus?: boolean;
}) {
    const [draft, setDraft] = useState(block.url);
    const [loading, setLoading] = useState(false);

    const hasCard = Boolean(block.url);

    // 입력한 URL의 Open Graph 메타를 서버에서 긁어 카드 필드를 채운다(작성자 전용).
    async function load() {
        const url = draft.trim();
        if (!url) {
            toast.error("먼저 링크 주소를 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const meta = await fetchLinkPreview(url);
            onChange({
                ...block,
                url: meta.url,
                title: meta.title,
                description: meta.description,
                image: meta.image,
                favicon: meta.favicon,
                siteName: meta.siteName,
            });
            setDraft(meta.url);
            toast.success("링크 정보를 불러왔어요.");
        } catch (e) {
            // 긁기 실패해도 URL만으로 최소 카드는 만들 수 있게 채운다.
            const host = hostOf(url);
            const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            onChange({
                ...block,
                url: normalized,
                title: block.title || host,
                description: block.description,
                image: block.image,
                favicon: block.favicon,
                siteName: block.siteName || host,
            });
            toast.error(e instanceof Error ? e.message : "링크 정보를 가져오지 못했어요. 주소만 저장했어요.");
        } finally {
            setLoading(false);
        }
    }

    // 실제 미리보기 카드(작성자·학습자 공통). 학습자 모드에선 클릭 시 새 탭으로 연다.
    const card = hasCard ? (
        <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={authoring ? (e) => e.preventDefault() : undefined}
            className={`group flex overflow-hidden rounded-xl border bg-card no-underline transition ${
                authoring ? "cursor-default" : "hover:border-primary/50 hover:shadow-sm"
            }`}
        >
            {/* 본문 — 제목·설명·사이트 */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
                <div className="line-clamp-2 font-semibold text-foreground">
                    {block.title || hostOf(block.url)}
                </div>
                {block.description && (
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                        {block.description}
                    </div>
                )}
                <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    {block.favicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={block.favicon}
                            alt=""
                            className="size-4 rounded-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    ) : (
                        <Globe className="size-4" />
                    )}
                    <span className="truncate">{block.siteName || hostOf(block.url)}</span>
                    {!authoring && (
                        <ExternalLink className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                    )}
                </div>
            </div>

            {/* 대표 이미지(있을 때만) */}
            {block.image && (
                <div className="hidden w-40 shrink-0 sm:block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={block.image}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            e.currentTarget.parentElement!.style.display = "none";
                        }}
                    />
                </div>
            )}
        </a>
    ) : null;

    // 학습자 모드 — 카드만(미설정이면 아무것도 안 보임).
    if (!authoring) {
        return card;
    }

    // 작성자 모드 — URL 입력 + 불러오기 + 미리보기 카드.
    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void load();
                            }
                        }}
                        placeholder="링크 주소를 붙여넣으세요 (예: https://example.com)"
                        autoFocus={autoFocus}
                        className="pl-9"
                        inputMode="url"
                    />
                </div>
                <Button type="button" onClick={load} disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" /> 불러오는 중
                        </>
                    ) : hasCard ? (
                        "새로고침"
                    ) : (
                        "불러오기"
                    )}
                </Button>
            </div>

            {card ?? (
                <div className="grid place-items-center gap-1 rounded-xl border border-dashed py-8 text-sm text-muted-foreground">
                    <LinkIcon className="size-5" />
                    링크를 불러오면 미리보기 카드가 만들어져요
                </div>
            )}
        </div>
    );
}
