/**
 * 수강생 등록 다이얼로그 — 아이디 검색으로 학생을 선택하거나 초대 코드를 복사해 수강생을 등록한다.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { searchUsers, enrollStudents } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import type { UserPublic } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface EnrollDialogProps {
    programId: string;
    programTitle: string;
    inviteCode: string;
    onEnrolled: () => void;
}

export function EnrollDialog({ programId, programTitle, inviteCode, onEnrolled }: EnrollDialogProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserPublic[]>([]);
    const [selected, setSelected] = useState<UserPublic[]>([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const users = await searchUsers(q.trim(), "student");
            setResults(users);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => search(query), 300);
        return () => clearTimeout(timer);
    }, [query, search]);

    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) {
            setQuery("");
            setResults([]);
            setSelected([]);
        }
    }

    function toggleSelect(user: UserPublic) {
        setSelected((prev) =>
            prev.some((u) => u.id === user.id)
                ? prev.filter((u) => u.id !== user.id)
                : [...prev, user]
        );
    }

    function removeSelected(userId: string) {
        setSelected((prev) => prev.filter((u) => u.id !== userId));
    }

    async function handleEnroll() {
        if (selected.length === 0) {
            toast.error("등록할 수강생을 선택해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const { enrolled, failed } = await enrollStudents(
                programId,
                selected.map((u) => u.id)
            );
            if (enrolled.length > 0) {
                toast.success(`${enrolled.length}명이 등록되었습니다.`);
            }
            if (failed.length > 0) {
                toast.error(`${failed.length}명 등록에 실패했습니다: ${failed.join(", ")}`);
            }
            setOpen(false);
            onEnrolled();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "등록에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    async function handleCopyCode() {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const text = `${programTitle}(${inviteCode})\n${origin}/join/${inviteCode}`;
        if (await copyText(text)) {
            toast.success("초대 링크가 복사되었습니다.");
        } else {
            toast.error("복사에 실패했습니다.");
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="lg" />}>
                <UserPlus />
                수강생 등록
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>수강생 등록</DialogTitle>
                    <DialogDescription>
                        아이디를 검색하여 수강생을 추가하거나, 초대 코드를 공유하세요.
                    </DialogDescription>
                </DialogHeader>

                {/* 초대 코드 안내 */}
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">초대 코드</p>
                        <p className="mono font-semibold tracking-widest">{inviteCode}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyCode}>
                        복사
                    </Button>
                </div>

                <Separator />

                {/* 검색 자동완성 */}
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">수강생 검색</p>
                    <Command className="rounded-lg border">
                        <CommandInput
                            placeholder="아이디 또는 이름으로 검색..."
                            value={query}
                            onValueChange={setQuery}
                        />
                        <CommandList>
                            {searching && (
                                <div className="py-3 text-center text-sm text-muted-foreground">
                                    검색 중...
                                </div>
                            )}
                            {!searching && query && results.length === 0 && (
                                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                            )}
                            {!searching && results.length > 0 && (
                                <CommandGroup heading="학생 계정">
                                    {results.map((user) => (
                                        <CommandItem
                                            key={user.id}
                                            value={user.id}
                                            onSelect={() => toggleSelect(user)}
                                            data-checked={selected.some((u) => u.id === user.id)}
                                        >
                                            <span className="font-medium">{user.name}</span>
                                            <span className="mono text-muted-foreground ml-1">@{user.id}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </div>

                {/* 선택된 수강생 */}
                {selected.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {selected.map((user) => (
                            <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                                {user.name}
                                <button
                                    onClick={() => removeSelected(user.id)}
                                    className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                                    aria-label={`${user.name} 선택 취소`}
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" size="lg" disabled={loading} />}>
                        취소
                    </DialogClose>
                    <Button size="lg" onClick={handleEnroll} disabled={loading || selected.length === 0}>
                        {loading ? "등록 중..." : `${selected.length}명 등록하기`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
