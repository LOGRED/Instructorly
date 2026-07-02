/**
 * 리치 텍스트 에디터 — 마크다운을 노션처럼 "서식 그대로" 편집하는 클라이언트 컴포넌트.
 * 내부는 Tiptap(StarterKit + tiptap-markdown)을 쓰지만, 입출력은 마크다운 문자열로만
 * 주고받아 저장 구조를 바꾸지 않는다(라운드트립). 상단 고정 툴바와 텍스트를 선택하면
 * 뜨는 버블 메뉴로 굵게·제목·목록 등을 넣는다. 입력 규칙도 살아 있어 `**`, `## `, `- ` 를
 * 타이핑하면 자동으로 서식이 적용된다.
 */
"use client";

import { useEffect, useRef } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import markdownItCjkFriendly from "markdown-it-cjk-friendly";
import { Bold, Italic, Heading2, List, ListOrdered, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

/** 에디터의 현재 서식 활성 상태(툴바·버블 강조용). */
type FmtState = {
    isEmpty: boolean;
    bold: boolean;
    italic: boolean;
    h2: boolean;
    bullet: boolean;
    ordered: boolean;
    quote: boolean;
};

const btnCls =
    "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

// tiptap-markdown 확장이 editor.storage.markdown에 직렬화 API를 단다(타입 보강이 없어 단언한다).
function getMarkdown(editor: Editor): string {
    return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

/** 서식 버튼 하나 — 활성 상태면 배경을 강조한다. */
function FmtButton({
    label,
    active,
    onClick,
    children,
}: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            // mousedown 기본 동작을 막아 선택 영역이 풀리지 않게 한다(버블 메뉴 유지).
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={cn(btnCls, active && "bg-card text-foreground shadow-sm")}
        >
            {children}
        </button>
    );
}

/** 고정 툴바와 버블 메뉴가 공유하는 서식 버튼 묶음. */
function FmtButtons({ editor, state }: { editor: Editor; state: FmtState | null }) {
    return (
        <>
            <FmtButton label="굵게" active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="size-4" />
            </FmtButton>
            <FmtButton label="기울임" active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="size-4" />
            </FmtButton>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <FmtButton
                label="제목"
                active={state?.h2}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Heading2 className="size-4" />
            </FmtButton>
            <FmtButton label="목록" active={state?.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="size-4" />
            </FmtButton>
            <FmtButton
                label="번호 목록"
                active={state?.ordered}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="size-4" />
            </FmtButton>
            <FmtButton label="인용" active={state?.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Quote className="size-4" />
            </FmtButton>
        </>
    );
}

/** 마크다운을 서식 그대로 편집하는 리치 에디터. value/onChange는 마크다운 문자열로 오간다. */
export function RichTextEditor({
    value,
    onChange,
    autoFocus,
    placeholder,
}: {
    value: string;
    onChange: (markdown: string) => void;
    autoFocus?: boolean;
    placeholder?: string;
}) {
    // onUpdate 콜백은 한 번만 등록되므로, 최신 onChange를 ref로 참조해 stale closure를 막는다.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });

    // 최초 마운트 시점의 마크다운(초기 본문). 이후 value 변화로 에디터를 리셋하지 않는다.
    const initialMarkdownRef = useRef(value);

    const editor = useEditor({
        // Next SSR 하이드레이션 경고를 피하려고 즉시 렌더를 끈다. 초기 본문은 onCreate에서 채운다.
        immediatelyRender: false,
        autofocus: autoFocus ? "end" : false,
        extensions: [
            StarterKit,
            Markdown.configure({ html: false, transformPastedText: true }),
        ],
        editorProps: {
            attributes: {
                class: "maketor-prose min-h-24 px-2.5 py-2 outline-none",
            },
        },
        // 초기 마크다운을 본문으로 채운다. tiptap-markdown 내부 markdown-it은 CJK 인접 강조
        // (예: **굵게**한글)를 못 살리므로, 프로젝트 렌더러(remark-cjk-friendly)와 동작을 맞추기
        // 위해 cjk-friendly 플러그인을 주입한 뒤 그 파서로 파싱한다.
        onCreate: ({ editor }) => {
            const md = (
                editor.storage as unknown as {
                    markdown: { parser: { md: { use: (plugin: unknown) => unknown } } };
                }
            ).markdown.parser.md;
            md.use(markdownItCjkFriendly);
            editor.commands.setContent(initialMarkdownRef.current);
        },
        // 편집할 때마다 Tiptap 문서를 마크다운으로 직렬화해 상위로 올린다(저장 포맷 유지).
        onUpdate: ({ editor }) => {
            onChangeRef.current(getMarkdown(editor));
        },
    });

    const state = useEditorState({
        editor,
        // 활성 서식 상태만 골라 구독한다(트랜잭션마다 전체 리렌더하지 않도록).
        selector: ({ editor }): FmtState | null =>
            editor
                ? {
                      isEmpty: editor.isEmpty,
                      bold: editor.isActive("bold"),
                      italic: editor.isActive("italic"),
                      h2: editor.isActive("heading", { level: 2 }),
                      bullet: editor.isActive("bulletList"),
                      ordered: editor.isActive("orderedList"),
                      quote: editor.isActive("blockquote"),
                  }
                : null,
    });

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/40 p-1">
                {editor && <FmtButtons editor={editor} state={state} />}
            </div>
            <div className="relative rounded-lg border border-input bg-transparent text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                {editor && state?.isEmpty && placeholder && (
                    <p className="pointer-events-none absolute left-2.5 top-2 text-base text-muted-foreground">
                        {placeholder}
                    </p>
                )}
                <EditorContent editor={editor} />
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
                    >
                        <FmtButtons editor={editor} state={state} />
                    </BubbleMenu>
                )}
            </div>
        </div>
    );
}
