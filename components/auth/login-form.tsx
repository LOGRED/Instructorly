/**
 * 로그인/회원가입 폼 — 탭 전환으로 로그인과 회원가입을 제공한다.
 * `/login` 페이지와 홈 화면의 로그인 다이얼로그가 이 컴포넌트를 함께 쓴다.
 */
"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { useIdentity } from "@/lib/identity";
import { login, register } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Role = "instructor" | "student";
type TabValue = "login" | "register";

/** 로그인/회원가입 후 이동할 경로. `?next=` 가 내부 경로이면 그쪽으로, 아니면 강좌 목록. */
function resolveNext(): string {
    if (typeof window === "undefined") return "/programs";
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "/programs";
}

// 로그인/회원가입 탭 폼 — 성공하면 이동 전에 onSuccess를 호출한다(다이얼로그 닫기 등).
export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
    const router = useRouter();
    const { setIdentity } = useIdentity();

    // 탭 전환 시 높이가 툭 바뀌지 않도록, Tabs 전체(탭 선택 줄 + 활성 패널)의 실제 높이를
    // 재서 바깥 래퍼에 애니메이션으로 적용한다. 활성 패널만 재면 탭 선택 줄 높이가 빠져
    // 콘텐츠 아래쪽이 잘리므로, 반드시 Tabs 루트 전체를 관찰 대상으로 삼는다.
    const [tab, setTab] = useState<TabValue>("login");
    const heightRef = useRef<HTMLDivElement>(null);
    const tabsRootRef = useRef<HTMLDivElement>(null);

    // 공통
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // 회원가입 전용
    const [name, setName] = useState("");
    const [role, setRole] = useState<Role>("student");

    useLayoutEffect(() => {
        const wrapper = heightRef.current;
        const root = tabsRootRef.current;
        if (!wrapper || !root) return;
        // 강제 리플로우로 "탭이 바뀌기 직전 높이"를 브라우저에 확정시킨 뒤 목표 높이로 바꿔야
        // height 트랜지션이 실제로 재생된다(리플로우 없이 바로 바꾸면 시작 프레임이 생략된다).
        void wrapper.offsetHeight;
        wrapper.style.height = `${root.offsetHeight}px`;
        const observer = new ResizeObserver(([entry]) => {
            wrapper.style.height = `${entry.contentRect.height}px`;
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, [tab]);

    async function handleLogin() {
        if (!id.trim() || !password.trim()) {
            toast.error("아이디와 비밀번호를 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const user = await login({ id: id.trim(), password });
            setIdentity(user.id, user.name, user.role, user.avatar);
            toast.success(`${user.name}님, 환영합니다!`);
            onSuccess?.();
            router.push(resolveNext());
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "로그인에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    async function handleRegister() {
        if (!id.trim() || !password.trim() || !name.trim()) {
            toast.error("모든 항목을 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            const user = await register({ id: id.trim(), password, name: name.trim(), role });
            setIdentity(user.id, user.name, user.role, user.avatar);
            toast.success(`${user.name}님, 환영합니다!`);
            onSuccess?.();
            router.push(resolveNext());
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "회원가입에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    function handleLoginKey(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") handleLogin();
    }

    function handleRegisterKey(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") handleRegister();
    }

    const tabs = (
        <Tabs ref={tabsRootRef} value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <TabsList className="w-full mb-6 min-h-10">
                <TabsTrigger value="login" className="flex-1 font-bold">
                    로그인
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1 font-bold">
                    회원가입
                </TabsTrigger>
            </TabsList>

            {/* ── 로그인 탭 ── */}
            <TabsContent value="login">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="login-id" className="text-base font-medium">
                            아이디
                        </Label>
                        <Input
                            id="login-id"
                            type="text"
                            placeholder="아이디를 입력하세요"
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                            onKeyDown={handleLoginKey}
                            className="h-12 text-lg px-4 focus-visible:ring-0"
                            autoComplete="username"
                            autoFocus
                            disabled={loading}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="login-pw" className="text-base font-medium">
                            비밀번호
                        </Label>
                        <Input
                            id="login-pw"
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleLoginKey}
                            className="h-12 text-lg px-4 focus-visible:ring-0"
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </div>
                    <Button
                        type="button"
                        size="lg"
                        className="h-12 text-lg mt-1"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        {loading ? "로그인 중..." : "로그인"}
                    </Button>
                </div>
            </TabsContent>

            {/* ── 회원가입 탭 ── */}
            <TabsContent value="register">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="reg-id" className="text-base font-medium">
                            아이디
                        </Label>
                        <Input
                            id="reg-id"
                            type="text"
                            placeholder="사용할 아이디를 입력하세요"
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                            onKeyDown={handleRegisterKey}
                            className="h-12 text-lg px-4 focus-visible:ring-0"
                            autoComplete="username"
                            disabled={loading}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="reg-pw" className="text-base font-medium">
                            비밀번호
                        </Label>
                        <Input
                            id="reg-pw"
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleRegisterKey}
                            className="h-12 text-lg px-4 focus-visible:ring-0"
                            autoComplete="new-password"
                            disabled={loading}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="reg-name" className="text-base font-medium">
                            이름
                        </Label>
                        <Input
                            id="reg-name"
                            type="text"
                            placeholder="실명 또는 표시 이름"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleRegisterKey}
                            maxLength={20}
                            className="h-12 text-lg px-4 focus-visible:ring-0"
                            autoComplete="name"
                            disabled={loading}
                        />
                    </div>

                    {/* 역할 선택 */}
                    <div className="flex flex-col gap-2">
                        <Label className="text-base font-medium">
                            어떤 분이신가요?
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole("instructor")}
                                disabled={loading}
                                className={cn(
                                    "rounded-lg border-2 p-4 text-center min-h-28 flex flex-col items-center justify-center gap-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    role === "instructor"
                                        ? "border-primary bg-primary/10"
                                        : "border-border bg-background hover:bg-muted/50"
                                )}
                            >
                                <GraduationCap className="size-7 text-foreground" />
                                <span className="text-base font-semibold">강사</span>
                                <span className="text-xs text-muted-foreground">
                                    강의를 만들어요
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole("student")}
                                disabled={loading}
                                className={cn(
                                    "rounded-lg border-2 p-4 text-center min-h-28 flex flex-col items-center justify-center gap-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    role === "student"
                                        ? "border-primary bg-primary/10"
                                        : "border-border bg-background hover:bg-muted/50"
                                )}
                            >
                                <BookOpen className="size-7 text-foreground" />
                                <span className="text-base font-semibold">학생</span>
                                <span className="text-xs text-muted-foreground">
                                    강의를 들어요
                                </span>
                            </button>
                        </div>
                    </div>

                    <Button
                        type="button"
                        size="lg"
                        className="h-12 text-lg mt-1"
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? "가입 중..." : "회원가입"}
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
    );

    return (
        <div
            ref={heightRef}
            className="overflow-hidden transition-[height] duration-300 ease-in-out"
        >
            {tabs}
        </div>
    );
}
