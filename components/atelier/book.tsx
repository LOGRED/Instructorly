/**
 * 창작 실습 '책' 렌더러 — 표지·본문 페이지를 실제 책처럼 그린다.
 *
 * 화면 미리보기(BookPreview, 넘김 뷰어)와 PDF 캡처용 숨김 레이어(BookExportLayer)가
 * 같은 페이지 렌더러(고정 px FixedPage + CoverInner/PageInner)를 공유한다 — 미리보기와
 * 출력이 1:1로 같게 나온다. 색은 모두 테마의 hex 값으로 두어 캡처가 안전하다.
 */
"use client";

import { forwardRef, useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { AtelierDoc, AtelierFont, AtelierTheme, Block } from "@/lib/types";
import { genreMeta, effectiveRatio, effectiveFont, type PageRatio } from "@/lib/atelier-templates";
import { groupBlocksIntoRows, blockFlexStyle } from "@/lib/block-layout";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import {
    EditFieldDialog,
    type AtelierEditField,
    type AtelierFieldTarget,
} from "@/components/atelier/edit-field-dialog";

/** 종횡비 → 캡처/렌더용 고정 픽셀 크기(미리보기는 이걸 비율 축소해 보여 준다). */
export function pagePx(ratio: PageRatio): { w: number; h: number } {
    switch (ratio) {
        case "square":
            return { w: 880, h: 880 };
        case "wide":
        case "a4l":
            return { w: 1160, h: 820 };
        case "r4_3":
            return { w: 1160, h: 870 };
        case "r3_4":
            return { w: 870, h: 1160 };
        case "a4":
        default:
            return { w: 820, h: 1160 };
    }
}

/** 글꼴 계열 → 실제 CSS 글꼴 스택(시스템 폰트 폴백 포함). */
export function fontStack(f: AtelierFont): string {
    switch (f) {
        case "serif":
            return "'Nanum Myeongjo', 'Apple SD Gothic Neo', Georgia, serif";
        case "round":
            return "'Apple SD Gothic Neo', 'Nanum Gothic', 'Segoe UI', sans-serif";
        case "sans":
        default:
            return "'Pretendard', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif";
    }
}

/** hex 색에 알파를 입혀 rgba 문자열을 만든다(연한 배경·테두리용). */
function hexA(hex: string, a: number): string {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 책 위에서 학생이 눌러 고칠 수 있는 블럭 종류(나머지는 읽기 전용으로 그린다). */
const ATELIER_EDITABLE_TYPES = new Set<Block["type"]>(["heading", "text", "quote", "callout", "image"]);

/** 이 블럭을 학생이 책 위에서 눌러 고칠 수 있는지. */
function isEditableType(type: Block["type"]): boolean {
    return ATELIER_EDITABLE_TYPES.has(type);
}

/** 블럭 종류 → 칸 이름(다이얼로그 제목·안내에 쓴다). */
function blockFieldLabel(type: Block["type"]): string {
    switch (type) {
        case "heading":
            return "제목";
        case "text":
            return "글";
        case "quote":
            return "인용";
        case "callout":
            return "강조 글";
        case "image":
            return "그림";
        default:
            return "내용";
    }
}

/** 텍스트형 블럭의 현재 글자를 꺼낸다(없으면 빈 문자열). */
function blockTextValue(block: Block): string {
    if (block.type === "text") return block.markdown;
    if (block.type === "heading" || block.type === "quote" || block.type === "callout") return block.text;
    return "";
}

/** 빈 칸일 때 보일 안내 문구(책 위 칸 + 입력창 공통). */
function blockPlaceholder(type: Block["type"]): string {
    switch (type) {
        case "heading":
            return "여기를 눌러 제목을 써요";
        case "text":
            return "여기를 눌러 글을 써요";
        case "quote":
            return "여기를 눌러 한 줄을 써요";
        case "callout":
            return "여기를 눌러 강조할 말을 써요";
        default:
            return "여기를 눌러 내용을 써요";
    }
}

/** 편집 가능한 한 '칸'을 책 위에 또렷이 표시한다 — 번호 뱃지 + 옅은 점선 테두리(배경은 투명).
 *  누르면(클릭·Enter·Space) 큰 다이얼로그가 떠 그 칸만 고친다. 배경을 두지 않아 책의 원래
 *  모습을 가리지 않으면서, 번호와 테두리로 '여기를 고칠 수 있다'를 자연스럽게 알린다. */
function EditableField({
    number,
    theme,
    onEdit,
    children,
}: {
    number: number;
    theme: AtelierTheme;
    onEdit: () => void;
    children: ReactNode;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onEdit}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit();
                }
            }}
            className="group relative cursor-pointer rounded-xl outline-none transition-colors"
            style={{
                border: `1.5px dashed ${hexA(theme.accent, 0.5)}`,
                background: "transparent",
                padding: "12px 14px",
            }}
        >
            {/* 칸 번호 뱃지 */}
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    top: -14,
                    left: -11,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: theme.accent,
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                }}
            >
                {number}
            </span>
            {children}
        </div>
    );
}

/** 한 블럭을 책용으로 정적 렌더한다(읽기 전용). 학생 편집은 이 위에 EditableField 래퍼를
 *  씌우고 다이얼로그로 처리한다 — 이 함수는 미리보기·출력·다이얼로그 미리보기가 공유한다. */
function AtelierBlockView({
    block,
    theme,
}: {
    block: Block;
    theme: AtelierTheme;
}) {
    switch (block.type) {
        case "heading": {
            const size = block.level === 1 ? "2.1rem" : block.level === 2 ? "1.55rem" : "1.25rem";
            const style: CSSProperties = { fontSize: size, fontWeight: 700, color: theme.pageText, lineHeight: 1.3 };
            return <div style={style}>{block.text || ""}</div>;
        }
        case "text": {
            const style: CSSProperties = { color: theme.pageText, fontSize: "1.05rem", lineHeight: 1.9, whiteSpace: "pre-wrap" };
            return (
                <div style={style}>
                    <Markdown>{block.markdown}</Markdown>
                </div>
            );
        }
        case "quote": {
            const style: CSSProperties = {
                borderLeft: `3px solid ${theme.accent}`,
                paddingLeft: 16,
                fontStyle: "italic",
                color: theme.pageText,
                opacity: 0.88,
                fontSize: "1.05rem",
                lineHeight: 1.8,
            };
            return <blockquote style={style}>{block.text}</blockquote>;
        }
        case "callout":
            return (
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        borderRadius: 14,
                        padding: 16,
                        background: hexA(theme.accent, 0.1),
                        border: `1px solid ${hexA(theme.accent, 0.25)}`,
                        color: theme.pageText,
                    }}
                >
                    <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{block.emoji}</span>
                    <div style={{ fontSize: "1rem", lineHeight: 1.7, flex: 1 }}>{block.text}</div>
                </div>
            );
        case "divider":
            return <hr style={{ border: "none", borderTop: `1px solid ${theme.accent}`, opacity: 0.4, margin: "6px 0" }} />;
        case "image":
            return block.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={block.imageUrl}
                    alt={block.prompt || ""}
                    crossOrigin="anonymous"
                    style={{ width: "100%", borderRadius: 14, display: "block", objectFit: "cover" }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        borderRadius: 14,
                        border: `1px dashed ${hexA(theme.accent, 0.4)}`,
                        background: hexA(theme.accent, 0.06),
                        display: "grid",
                        placeItems: "center",
                        textAlign: "center",
                        padding: 16,
                        color: hexA(theme.pageText, 0.6),
                        fontSize: "0.9rem",
                    }}
                >
                    <span>🖼️ {block.prompt ? `"${block.prompt}"` : "이미지 자리"}</span>
                </div>
            );
        case "table":
            return (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem", color: theme.pageText }}>
                    <thead>
                        <tr>
                            {block.headers.map((h, i) => (
                                <th
                                    key={i}
                                    style={{
                                        border: `1px solid ${hexA(theme.pageText, 0.25)}`,
                                        padding: "6px 10px",
                                        background: hexA(theme.accent, 0.1),
                                        textAlign: "left",
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, ri) => (
                            <tr key={ri}>
                                {row.map((c, ci) => (
                                    <td key={ci} style={{ border: `1px solid ${hexA(theme.pageText, 0.18)}`, padding: "6px 10px" }}>
                                        {c}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        case "chart": {
            // 책에는 차트를 간단한 막대 목록으로 정적 표현한다(캡처 안전).
            const max = Math.max(1, ...block.data.map((d) => d.value));
            return (
                <div style={{ color: theme.pageText }}>
                    {block.title && <div style={{ fontWeight: 600, marginBottom: 8 }}>{block.title}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {block.data.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                                <span style={{ width: 64, flexShrink: 0 }}>{d.label}</span>
                                <span
                                    style={{
                                        height: 14,
                                        borderRadius: 7,
                                        background: theme.accent,
                                        width: `${(d.value / max) * 100}%`,
                                        minWidth: 4,
                                    }}
                                />
                                <span style={{ opacity: 0.7 }}>{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        case "bookmark":
            return (
                <a
                    href={block.url}
                    style={{
                        display: "block",
                        border: `1px solid ${hexA(theme.pageText, 0.2)}`,
                        borderRadius: 12,
                        padding: 12,
                        color: theme.pageText,
                        textDecoration: "none",
                    }}
                >
                    <div style={{ fontWeight: 600 }}>{block.title || block.url}</div>
                    {block.description && <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{block.description}</div>}
                </a>
            );
        case "video":
        case "audio":
            return (
                <div
                    style={{
                        borderRadius: 12,
                        border: `1px dashed ${hexA(theme.accent, 0.4)}`,
                        padding: 14,
                        color: hexA(theme.pageText, 0.7),
                        fontSize: "0.9rem",
                    }}
                >
                    {block.type === "video" ? "🎬 영상" : "🔊 오디오"} {block.caption ? `· ${block.caption}` : ""}
                </div>
            );
    }
}

/** 한 블럭의 편집 칸 정보를 만든다(다이얼로그에 넘길 값) — 블럭 전체를 넘겨 기존 편집기로 고친다. */
function buildBlockField(block: Block, number: number, pageIdx: number): AtelierEditField {
    return {
        kind: "block",
        target: { scope: "block", pageIdx, blockId: block.id },
        number,
        label: blockFieldLabel(block.type),
        block,
    };
}

/** 편집 칸 안에 보일 내용 — 값이 있으면 그대로 그리고, 비어 있으면 '여기를 눌러…' 안내를 보여 준다. */
function renderEditableBody(block: Block, theme: AtelierTheme): ReactNode {
    if (block.type === "image") return <AtelierBlockView block={block} theme={theme} />;
    if (blockTextValue(block).trim()) return <AtelierBlockView block={block} theme={theme} />;
    return (
        <span style={{ color: hexA(theme.pageText, 0.5), fontSize: "1.05rem", fontWeight: 500 }}>
            {blockPlaceholder(block.type)}
        </span>
    );
}

/** 본문 한 쪽을 그린다(블럭들을 한 줄 배치 규칙대로 묶어 렌더). onEdit이 있으면(학생) 편집 가능한
 *  블럭마다 번호 칸을 씌워 눌러서 고치게 한다. */
function PageInner({
    doc,
    page,
    pageNo,
    pageIdx,
    onEdit,
}: {
    doc: AtelierDoc;
    page: AtelierDoc["pages"][number];
    pageNo: number;
    /** 이 쪽이 doc.pages에서 몇 번째인지(0-기준) — 편집 저장 위치표에 쓴다. */
    pageIdx?: number;
    /** 편집 칸을 눌렀을 때 고칠 칸 정보를 올린다(있으면 학생 편집 모드). */
    onEdit?: (field: AtelierEditField) => void;
}) {
    const { theme } = doc;
    const rows = groupBlocksIntoRows(page.blocks);
    // 편집 가능한 블럭에 1,2,3… 번호를 매긴다(이 쪽 안에서, page.blocks 순서 기준).
    const numberOf = new Map<string, number>();
    if (onEdit) {
        let n = 0;
        for (const b of page.blocks) {
            if (isEditableType(b.type)) numberOf.set(b.id, ++n);
        }
    }
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                background: theme.pageBg,
                color: theme.pageText,
                fontFamily: fontStack(effectiveFont(doc)),
                padding: "56px 56px 64px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxSizing: "border-box",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1, minHeight: 0 }}>
                {rows.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                        {row.map((b) => {
                            const num = numberOf.get(b.id);
                            return (
                                <div key={b.id} style={blockFlexStyle(b.width)}>
                                    {onEdit && num != null ? (
                                        <EditableField
                                            number={num}
                                            theme={theme}
                                            onEdit={() => onEdit(buildBlockField(b, num, pageIdx ?? 0))}
                                        >
                                            {renderEditableBody(b, theme)}
                                        </EditableField>
                                    ) : (
                                        <AtelierBlockView block={b} theme={theme} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            {/* 쪽 번호 */}
            <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", fontSize: "0.8rem", color: hexA(theme.pageText, 0.45) }}>
                {pageNo}
            </div>
        </div>
    );
}

/** 표지를 그린다(이미지가 있으면 배경, 없으면 테마 색). onEdit이 있으면(학생) 제목·부제·지은이를
 *  번호 칸으로 눌러 고친다. */
function CoverInner({
    doc,
    editable,
    onEdit,
}: {
    doc: AtelierDoc;
    editable?: boolean;
    onEdit?: (field: AtelierEditField) => void;
}) {
    const { theme, cover } = doc;
    const meta = genreMeta(doc.genre);
    // 표지 글자 칸(제목·부제·지은이)의 편집 칸 정보를 만든다(단순 입력으로 고친다).
    const coverField = (key: "title" | "subtitle" | "author", number: number): AtelierEditField => ({
        kind: "cover",
        target: { scope: "cover", key },
        number,
        label: key === "title" ? "책 제목" : key === "subtitle" ? "부제" : "지은이",
        value: cover[key],
        placeholder:
            key === "title"
                ? "여기를 눌러 책 제목을 써요"
                : key === "subtitle"
                  ? "여기를 눌러 부제를 써요"
                  : "여기를 눌러 이름을 써요",
    });
    // 표지 글자색 — 이미지 표지면 흰색, 아니면 테마 글자색(투명 칸 위에서도 또렷이).
    const coverTextColor = cover.image ? "#fff" : theme.coverText;
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                background: cover.image ? "#000" : theme.coverBg,
                color: theme.coverText,
                fontFamily: fontStack(effectiveFont(doc)),
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                padding: 56,
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            {cover.image && (
                <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={cover.image}
                        alt=""
                        crossOrigin="anonymous"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.65))" }} />
                </>
            )}
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", color: cover.image ? "#fff" : theme.coverText }}>
                <span
                    style={{
                        fontSize: "0.85rem",
                        letterSpacing: "0.2em",
                        padding: "4px 14px",
                        borderRadius: 999,
                        border: `1px solid ${cover.image ? "rgba(255,255,255,0.6)" : hexA(theme.coverText, 0.4)}`,
                    }}
                >
                    {meta.label.toUpperCase()}
                </span>
                {editable && onEdit ? (
                    <EditableField number={1} theme={theme} onEdit={() => onEdit(coverField("title", 1))}>
                        <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.25, textAlign: "center", color: coverTextColor, opacity: cover.title ? 1 : 0.55 }}>
                            {cover.title || "여기를 눌러 책 제목을 써요"}
                        </div>
                    </EditableField>
                ) : (
                    <h1 style={{ fontSize: "2.8rem", fontWeight: 800, lineHeight: 1.25, margin: 0 }}>
                        {cover.title || "제목을 입력하세요"}
                    </h1>
                )}
                {editable && onEdit ? (
                    <EditableField number={2} theme={theme} onEdit={() => onEdit(coverField("subtitle", 2))}>
                        <div style={{ fontSize: "1.1rem", textAlign: "center", color: coverTextColor, opacity: cover.subtitle ? 0.85 : 0.55 }}>
                            {cover.subtitle || "여기를 눌러 부제를 써요 (없어도 돼요)"}
                        </div>
                    </EditableField>
                ) : (
                    cover.subtitle && <p style={{ fontSize: "1.1rem", opacity: 0.85, margin: 0 }}>{cover.subtitle}</p>
                )}
                <span style={{ width: 56, height: 3, borderRadius: 2, background: cover.image ? "#fff" : theme.accent }} />
                {editable && onEdit ? (
                    <EditableField number={3} theme={theme} onEdit={() => onEdit(coverField("author", 3))}>
                        <div style={{ fontSize: "1rem", textAlign: "center", color: coverTextColor, opacity: cover.author ? 0.85 : 0.55 }}>
                            {cover.author ? `지은이 · ${cover.author}` : "여기를 눌러 이름을 써요"}
                        </div>
                    </EditableField>
                ) : (
                    cover.author && <p style={{ fontSize: "1rem", opacity: 0.8, margin: 0 }}>지은이 · {cover.author}</p>
                )}
            </div>
        </div>
    );
}

/** 캡처 대상이 되는 고정 크기 페이지 박스(.atelier-page 클래스로 export가 찾는다). */
function FixedPage({
    ratio,
    children,
    className,
}: {
    ratio: PageRatio;
    children: ReactNode;
    className?: string;
}) {
    const { w, h } = pagePx(ratio);
    return (
        <div className={cn("atelier-page", className)} style={{ width: w, height: h, overflow: "hidden", position: "relative" }}>
            {children}
        </div>
    );
}

/** PDF 캡처용 숨김 레이어 — 표지 + 모든 본문 페이지를 원본 크기로 화면 밖에 쌓아 둔다. */
export const BookExportLayer = forwardRef<HTMLDivElement, { doc: AtelierDoc }>(
    function BookExportLayer({ doc }, ref) {
        const ratio = effectiveRatio(doc);
        return (
            <div ref={ref} aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 1 }}>
                <FixedPage ratio={ratio}>
                    <CoverInner doc={doc} />
                </FixedPage>
                {doc.pages.map((p, i) => (
                    <FixedPage key={p.id} ratio={ratio}>
                        <PageInner doc={doc} page={p} pageNo={i + 1} />
                    </FixedPage>
                ))}
            </div>
        );
    },
);

/** 화면용 책 미리보기 — 한 쪽씩 넘겨 보는 뷰어. 컨테이너 크기에 맞춰 자동 축소한다. */
export function BookPreview({
    doc,
    className,
    editable,
    onChange,
}: {
    doc: AtelierDoc;
    className?: string;
    /** true면 책 위에서 글자·그림을 바로 편집(학생용). */
    editable?: boolean;
    /** 편집 커밋 시 갱신된 문서를 올린다. */
    onChange?: (doc: AtelierDoc) => void;
}) {
    const ratio = effectiveRatio(doc);
    const { w, h } = pagePx(ratio);
    const total = doc.pages.length + 1; // 표지 + 본문
    const [idx, setIdx] = useState(0);
    const roRef = useRef<ResizeObserver | null>(null);
    const rafRef = useRef<number | null>(null);
    const [scale, setScale] = useState(0.5);
    // 지금 고치는 칸 — 책 위 번호 칸을 누르면 채워지고 다이얼로그가 뜬다. null이면 닫힘.
    const [active, setActive] = useState<AtelierEditField | null>(null);

    // 컨테이너에 맞춰 페이지 배율을 다시 잰다(절대 원본보다 키우지 않음). 크기가 아직 0이면
    // 측정 실패로 보고 false를 돌려준다.
    const fit = useCallback(
        (el: HTMLElement): boolean => {
            const availW = el.clientWidth - 24;
            const availH = el.clientHeight - 24;
            if (availW <= 0 || availH <= 0) return false;
            setScale(Math.min(availW / w, availH / h, 1));
            return true;
        },
        [w, h],
    );

    // 미리보기 컨테이너에 콜백 ref로 ResizeObserver를 직접 건다. 다이얼로그/포털 안에서는
    // 마운트 직후 크기가 0이거나, 열림 애니메이션이 transform(zoom)이라 ResizeObserver가
    // 깨어나지 않아 배율이 기본값(0.5)에 멈춰 책이 컨테이너보다 크게 잘려 보이던 문제를 막는다.
    // 크기가 잡힐 때까지 rAF로 몇 프레임 더 재서 첫 측정을 보장한다.
    const setWrap = useCallback(
        (el: HTMLDivElement | null) => {
            roRef.current?.disconnect();
            roRef.current = null;
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            if (!el) return;
            let tries = 0;
            const tick = () => {
                if (fit(el) || tries++ > 30) {
                    rafRef.current = null;
                    return;
                }
                rafRef.current = requestAnimationFrame(tick);
            };
            tick();
            const ro = new ResizeObserver(() => fit(el));
            ro.observe(el);
            roRef.current = ro;
        },
        [fit],
    );

    // 페이지 수가 줄어도 안전하도록 렌더 시점에 인덱스를 범위로 보정한다(effect 없이).
    const current = Math.min(Math.max(0, idx), total - 1);
    const label = current === 0 ? "표지" : `${current} / ${doc.pages.length}`;

    // 표지 인라인 편집 커밋.
    const commitCover = (patch: Partial<AtelierDoc["cover"]>) =>
        onChange?.({ ...doc, cover: { ...doc.cover, ...patch } });
    // 본문 블럭 편집 커밋(해당 쪽의 해당 블럭만 갱신).
    const commitBlock = (pageIdx: number, blockId: string, patch: Partial<Block>) =>
        onChange?.({
            ...doc,
            pages: doc.pages.map((p, i) =>
                i === pageIdx
                    ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)) }
                    : p,
            ),
        });
    // 다이얼로그의 표지 글자(제목·부제·지은이) 저장을 반영한다.
    const saveCover = (key: "title" | "subtitle" | "author", value: string) =>
        commitCover({ [key]: value } as Partial<AtelierDoc["cover"]>);
    // 다이얼로그의 블럭 편집(글·제목·인용·강조·그림)을 해당 블럭에 통째로 반영한다.
    const saveBlock = (target: AtelierFieldTarget, block: Block) => {
        if (target.scope === "block") commitBlock(target.pageIdx, target.blockId, block);
    };

    return (
        <div className={cn("flex h-full flex-col gap-3", className)}>
            <div ref={setWrap} className="relative grid min-h-0 min-w-0 flex-1 place-items-center overflow-hidden rounded-2xl bg-muted/40 p-3">
                <div style={{ width: w * scale, height: h * scale, maxWidth: "100%", maxHeight: "100%" }}>
                    <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                        <FixedPage ratio={ratio} className="rounded-xl shadow-xl ring-1 ring-black/5">
                            {current === 0 ? (
                                <CoverInner doc={doc} editable={editable} onEdit={editable ? setActive : undefined} />
                            ) : (
                                <PageInner
                                    doc={doc}
                                    page={doc.pages[current - 1]}
                                    pageNo={current}
                                    pageIdx={current - 1}
                                    onEdit={editable ? setActive : undefined}
                                />
                            )}
                        </FixedPage>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-center gap-4">
                <button
                    type="button"
                    onClick={() => setIdx(Math.max(0, current - 1))}
                    disabled={current === 0}
                    className="grid size-9 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    aria-label="이전 쪽"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-20 text-center text-sm tabular-nums text-muted-foreground">{label}</span>
                <button
                    type="button"
                    onClick={() => setIdx(Math.min(total - 1, current + 1))}
                    disabled={current >= total - 1}
                    className="grid size-9 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    aria-label="다음 쪽"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>

            {/* 눌러서 고치기 다이얼로그(학생 편집 모드에서만, 칸을 누르면 떠 그 칸만 고친다) */}
            {editable && active && (
                <EditFieldDialog
                    field={active}
                    theme={doc.theme}
                    onClose={() => setActive(null)}
                    onSaveCover={saveCover}
                    onSaveBlock={saveBlock}
                />
            )}
        </div>
    );
}
