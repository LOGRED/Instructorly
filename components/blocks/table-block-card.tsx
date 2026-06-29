/**
 * 표 블럭 카드 — 행·열로 이뤄진 표 데이터를 편집(빌더)하거나 읽기 전용(학습자)으로 보여 준다.
 * `authoring=true`(빌더)는 칸 편집 + 행·열 추가/삭제를, `authoring=false`(학습자)는 정적 표만 렌더한다.
 * 차트와 달리 AI 생성이 없는 정적 콘텐츠 블럭이라 모델 선택·비용 표시가 없다.
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TableBlock } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// 표 블럭 카드를 렌더한다(빌더=편집, 학습자=읽기 전용).
export function TableBlockCard({
    block,
    onChange,
    authoring = true,
}: {
    block: TableBlock;
    onChange: (b: TableBlock) => void;
    /** 빌더(작성자)면 true — 칸 편집·행/열 추가·삭제. 학습자면 false — 정적 표. */
    authoring?: boolean;
}) {
    const cols = block.headers.length;

    // 머리글 한 칸을 고친다.
    function setHeader(c: number, v: string) {
        const headers = block.headers.map((h, i) => (i === c ? v : h));
        onChange({ ...block, headers });
    }

    // 본문 한 칸을 고친다.
    function setCell(r: number, c: number, v: string) {
        const rows = block.rows.map((row, ri) =>
            ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row,
        );
        onChange({ ...block, rows });
    }

    // 맨 끝에 빈 행을 추가한다.
    function addRow() {
        onChange({ ...block, rows: [...block.rows, Array(cols).fill("")] });
    }

    // 지정한 행을 삭제한다(최소 1행 유지).
    function removeRow(r: number) {
        if (block.rows.length <= 1) return;
        onChange({ ...block, rows: block.rows.filter((_, i) => i !== r) });
    }

    // 맨 끝에 빈 열을 추가한다(머리글 + 모든 본문 행에 한 칸씩).
    function addCol() {
        onChange({
            ...block,
            headers: [...block.headers, ""],
            rows: block.rows.map((row) => [...row, ""]),
        });
    }

    // 지정한 열을 삭제한다(최소 1열 유지).
    function removeCol(c: number) {
        if (cols <= 1) return;
        onChange({
            ...block,
            headers: block.headers.filter((_, i) => i !== c),
            rows: block.rows.map((row) => row.filter((_, i) => i !== c)),
        });
    }

    // 학습자(읽기 전용) — 정적 표.
    if (!authoring) {
        return (
            <div className="overflow-x-auto rounded-xl border">
                <table className="w-full border-collapse text-base">
                    <thead>
                        <tr className="bg-muted/50">
                            {block.headers.map((h, c) => (
                                <th key={c} className="border-b px-4 py-2.5 text-left font-semibold">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, r) => (
                            <tr key={r} className="border-b last:border-b-0">
                                {row.map((cell, c) => (
                                    <td key={c} className="px-4 py-2.5">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // 빌더(작성자) — 칸 편집 + 행/열 추가·삭제.
    return (
        <div className="space-y-2 rounded-xl border bg-card p-3">
            <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1">
                    <thead>
                        <tr>
                            {block.headers.map((h, c) => (
                                <th key={c} className="min-w-28">
                                    <div className="flex items-center gap-1">
                                        <Input
                                            value={h}
                                            onChange={(e) => setHeader(c, e.target.value)}
                                            placeholder={`열 ${c + 1}`}
                                            className="h-9 font-semibold"
                                            aria-label={`머리글 ${c + 1}`}
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="size-8 shrink-0 text-muted-foreground"
                                            onClick={() => removeCol(c)}
                                            disabled={cols <= 1}
                                            aria-label={`열 ${c + 1} 삭제`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </th>
                            ))}
                            <th className="w-10">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="size-9"
                                    onClick={addCol}
                                    aria-label="열 추가"
                                >
                                    <Plus className="size-4" />
                                </Button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, r) => (
                            <tr key={r}>
                                {row.map((cell, c) => (
                                    <td key={c}>
                                        <Input
                                            value={cell}
                                            onChange={(e) => setCell(r, c, e.target.value)}
                                            className="h-9"
                                            aria-label={`${r + 1}행 ${c + 1}열`}
                                        />
                                    </td>
                                ))}
                                <td className="w-10">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="size-9 text-muted-foreground"
                                        onClick={() => removeRow(r)}
                                        disabled={block.rows.length <= 1}
                                        aria-label={`${r + 1}행 삭제`}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
                <Plus className="size-4" /> 행 추가
            </Button>
        </div>
    );
}
