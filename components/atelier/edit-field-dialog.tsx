/**
 * 창작 실습 '눌러서 고치기' 다이얼로그 — 책 미리보기에서 번호 칸을 누르면 떠서, 그 칸만 집중해
 * 고친다. 노인 학습자가 무엇을 바꿀 수 있는지 분명히 알고 실수 없이 고치도록 만든 화면이다.
 *
 * 글자 블럭(제목·글·인용·강조)은 기존 블럭 편집기(BlockEdit)를 그대로 띄운다 — 글(text)은
 * 굵게·제목·목록 같은 강조와 AI 생성을 모두 쓸 수 있다. 그림 칸은 설명으로 AI 생성하거나
 * 사진을 올린다. 표지 글자(책 제목·부제·지은이)는 단순 입력으로 고친다. 고치는 즉시 책에
 * 반영된다(라이브 커밋).
 */
"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import type { AtelierTheme, Block, ImageBlock } from "@/lib/types";
import { useIdentity } from "@/lib/identity";
import { studioGenerate, generateImage, uploadFile } from "@/lib/api";
import { BlockEdit } from "@/components/blocks/block-edit";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** 어떤 칸을 고치는지 가리키는 위치표 — 저장 시 이 값으로 문서의 정확한 자리에 반영한다. */
export type AtelierFieldTarget =
    | { scope: "cover"; key: "title" | "subtitle" | "author" }
    | { scope: "block"; pageIdx: number; blockId: string };

/** 다이얼로그가 열려 고치는 한 칸의 정보(번호·이름·대상). */
export type AtelierEditField =
    | {
          kind: "cover";
          target: AtelierFieldTarget;
          /** 책 위 칸 번호(①②③…). */
          number: number;
          /** 칸 이름(예: '책 제목'). */
          label: string;
          /** 현재 글자. */
          value: string;
          /** 비어 있을 때 입력창에 보일 안내. */
          placeholder: string;
      }
    | {
          kind: "block";
          target: AtelierFieldTarget;
          number: number;
          label: string;
          /** 고칠 블럭(글·제목·인용·강조·그림). */
          block: Block;
      };

/** hex 색에 알파를 입혀 rgba 문자열을 만든다(연한 배경·테두리용 · book.tsx와 동일 규칙). */
function hexA(hex: string, a: number): string {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 칸 종류에 맞는 한 줄 안내를 만든다(노인이 무엇을 하면 되는지). */
function fieldHint(field: AtelierEditField): string {
    if (field.kind === "cover") return "아래 칸에 적으면 책에 바로 들어가요.";
    if (field.block.type === "image") return "그림 설명을 적고 [그림 만들기]를 누르거나, 사진을 올려요.";
    if (field.block.type === "text") return "글을 쓰고 위 버튼으로 굵게·제목을 넣어요. [AI 생성]으로 만들 수도 있어요.";
    return "아래 칸에 적으면 책에 바로 들어가요.";
}

/** 책 위 칸을 누르면 떠서 그 칸만 고치는 다이얼로그. field가 없으면 렌더하지 않는다(깔끔히 닫힘). */
export function EditFieldDialog({
    field,
    theme,
    onClose,
    onSaveCover,
    onSaveBlock,
}: {
    field: AtelierEditField | null;
    theme: AtelierTheme;
    onClose: () => void;
    /** 표지 글자 저장 — 키와 새 글자를 올린다. */
    onSaveCover: (key: "title" | "subtitle" | "author", value: string) => void;
    /** 블럭 저장 — 위치표와 바뀐 블럭 전체를 올린다(라이브). */
    onSaveBlock: (target: AtelierFieldTarget, block: Block) => void;
}) {
    if (!field) return null;
    return (
        <Dialog
            open
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="flex-row items-center gap-3 p-5 pb-4">
                    <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-full text-lg font-extrabold text-white shadow"
                        style={{ background: theme.accent }}
                    >
                        {field.number}
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-xl">{field.label} 고치기</DialogTitle>
                        <DialogDescription className="text-base">{fieldHint(field)}</DialogDescription>
                    </div>
                </DialogHeader>

                {field.kind === "cover" ? (
                    <CoverBody
                        key={field.target.scope === "cover" ? field.target.key : "cover"}
                        field={field}
                        onCommit={(v) => {
                            if (field.target.scope === "cover") onSaveCover(field.target.key, v);
                        }}
                        onClose={onClose}
                    />
                ) : (
                    <BlockBody
                        key={field.block.id}
                        field={field}
                        theme={theme}
                        onCommit={(b) => onSaveBlock(field.target, b)}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** 표지 글자 칸(제목·부제·지은이) 본문 — 큰 단순 입력. 고치는 즉시 책에 반영. */
function CoverBody({
    field,
    onCommit,
    onClose,
}: {
    field: Extract<AtelierEditField, { kind: "cover" }>;
    onCommit: (value: string) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState(field.value);
    return (
        <>
            <div className="p-5">
                <label className="mb-2 block text-base font-semibold text-foreground">여기에 적어요</label>
                <input
                    autoFocus
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        onCommit(e.target.value);
                    }}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border-2 border-input bg-background p-4 text-lg outline-none transition-colors focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/30"
                />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-4">
                <Button size="lg" className="px-6 text-base font-semibold" onClick={onClose}>
                    <Check />
                    다 했어요
                </Button>
            </div>
        </>
    );
}

/** 블럭 칸 본문 — 글자류는 기존 BlockEdit(글은 강조·AI 생성 포함), 그림은 생성/업로드. 라이브 커밋. */
function BlockBody({
    field,
    theme,
    onCommit,
    onClose,
}: {
    field: Extract<AtelierEditField, { kind: "block" }>;
    theme: AtelierTheme;
    onCommit: (block: Block) => void;
    onClose: () => void;
}) {
    // 다이얼로그가 자체 초안을 들고 있어 책 갱신으로 입력기가 리셋되지 않게 한다.
    const [draft, setDraft] = useState<Block>(field.block);
    const commit = (b: Block) => {
        setDraft(b);
        onCommit(b);
    };
    return (
        <>
            <div className="max-h-[72vh] overflow-y-auto p-5">
                {draft.type === "image" ? (
                    <ImageBody block={draft} theme={theme} onChange={commit} />
                ) : (
                    <BlockEdit block={draft} onChange={commit} autoFocus />
                )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-4">
                <Button size="lg" className="px-6 text-base font-semibold" onClick={onClose}>
                    <Check />
                    다 했어요
                </Button>
            </div>
        </>
    );
}

/** 그림 칸 본문 — 그림 설명으로 AI 생성(강사가 고른 모델, 없으면 무료 FLUX) 또는 파일 업로드.
 *  학생도 사진을 올릴 수 있다(아틀리에 기본 동작). 결과는 즉시 책에 반영된다. */
function ImageBody({
    block,
    theme,
    onChange,
}: {
    block: ImageBlock;
    theme: AtelierTheme;
    onChange: (b: Block) => void;
}) {
    const userId = useIdentity((s) => s.userId);
    const userName = useIdentity((s) => s.nickname);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // 그림 설명으로 그림을 만든다(강사가 고른 모델 있으면 스튜디오, 없으면 무료 FLUX).
    async function gen() {
        const p = block.prompt.trim();
        if (!p) {
            toast.error("그림 설명을 입력해 주세요.");
            return;
        }
        setBusy(true);
        try {
            let url: string;
            if (block.model) {
                const res = await studioGenerate({
                    category: "image",
                    model: block.model,
                    modelLabel: block.modelLabel || block.model,
                    prompt: p,
                    userId: userId || undefined,
                    userName: userName || undefined,
                });
                url = res.output;
            } else {
                const res = await generateImage(p);
                url = res.dataUrl;
            }
            onChange({ ...block, prompt: p, imageUrl: url });
            toast.success("그림을 만들었어요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "그림 생성에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    // 파일을 올려 그림으로 쓴다.
    async function upload(file: File) {
        setBusy(true);
        try {
            const att = await uploadFile(file);
            onChange({ ...block, imageUrl: att.url });
            toast.success("그림을 올렸어요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "업로드에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            {/* 현재 그림 미리보기 */}
            <div
                className="grid place-items-center overflow-hidden rounded-xl border"
                style={{
                    aspectRatio: "4 / 3",
                    background: hexA(theme.accent, 0.06),
                    borderColor: hexA(theme.accent, 0.3),
                }}
            >
                {block.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.imageUrl} alt={block.prompt} className="size-full object-cover" />
                ) : (
                    <span className="px-6 text-center text-base" style={{ color: hexA(theme.pageText, 0.6) }}>
                        🖼️ 아직 그림이 없어요.
                        <br />
                        아래에 설명을 적고 그림을 만들어요.
                    </span>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-base font-semibold text-foreground">그림 설명</label>
                <textarea
                    value={block.prompt}
                    onChange={(e) => onChange({ ...block, prompt: e.target.value })}
                    placeholder="예: 별이 빛나는 밤하늘, 부드러운 수채화풍"
                    rows={2}
                    disabled={busy}
                    className="w-full resize-y rounded-xl border-2 border-input bg-background p-4 text-lg leading-relaxed outline-none transition-colors focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-60"
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    size="lg"
                    className="flex-1 text-base font-semibold"
                    onClick={gen}
                    disabled={busy}
                    style={{ background: theme.accent }}
                >
                    {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                    {block.imageUrl ? "다시 만들기" : "그림 만들기"}
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    className="text-base"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                >
                    <Upload />
                    사진 올리기
                </Button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(f);
                        e.target.value = "";
                    }}
                />
            </div>
        </div>
    );
}
