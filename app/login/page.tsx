/**
 * 로그인/회원가입 페이지 — 탭 전환으로 로그인과 회원가입을 제공하는 클라이언트 컴포넌트.
 */
"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { useIdentity } from "@/lib/identity";
import { login, register } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardHeader,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Role = "instructor" | "student";

/** 로그인/회원가입 후 이동할 경로. `?next=` 가 내부 경로이면 그쪽으로, 아니면 강좌 목록. */
function resolveNext(): string {
    if (typeof window === "undefined") return "/programs";
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "/programs";
}

export default function LoginPage() {
    const router = useRouter();
    const { setIdentity } = useIdentity();

    // 공통
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // 회원가입 전용
    const [name, setName] = useState("");
    const [role, setRole] = useState<Role>("student");

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

    return (
        <div className="min-h-screen grid place-items-center p-4 bg-background">
            <div className="w-full max-w-md flex flex-col gap-6">
                <Card>
                    <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-2">
                        <BrandLogo size={44} showWordmark href={null} />
                        <h1 className="text-2xl font-semibold text-center leading-snug">
                            시작하기
                        </h1>
                    </CardHeader>

                    <CardContent className="pt-4">
                        <Tabs defaultValue="login">
                            <TabsList className="w-full mb-6">
                                <TabsTrigger value="login" className="flex-1">
                                    로그인
                                </TabsTrigger>
                                <TabsTrigger value="register" className="flex-1">
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
                                            className="h-12 text-lg px-4"
                                            autoComplete="username"
                                            autoFocus
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
                                            className="h-12 text-lg px-4"
                                            autoComplete="current-password"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleLogin}
                                        disabled={loading}
                                        size="lg"
                                        className="w-full text-base mt-1"
                                    >
                                        {loading ? "로그인 중…" : "로그인"}
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
                                            className="h-12 text-lg px-4"
                                            autoComplete="username"
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
                                            className="h-12 text-lg px-4"
                                            autoComplete="new-password"
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
                                            className="h-12 text-lg px-4"
                                            autoComplete="name"
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
                                                className={cn(
                                                    "rounded-lg border p-4 text-center min-h-28 flex flex-col items-center justify-center gap-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    role === "instructor"
                                                        ? "border-primary ring-2 ring-primary bg-muted"
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
                                                className={cn(
                                                    "rounded-lg border p-4 text-center min-h-28 flex flex-col items-center justify-center gap-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    role === "student"
                                                        ? "border-primary ring-2 ring-primary bg-muted"
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
                                        onClick={handleRegister}
                                        disabled={loading}
                                        size="lg"
                                        className="w-full text-base mt-1"
                                    >
                                        {loading ? "처리 중…" : "회원가입"}
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-2 bg-transparent border-t-0 pt-0 pb-6 px-6">
                        <p className="text-xs text-muted-foreground text-center">
                            데모 계정 — 강사: <span className="font-mono">teacher / 1234</span>,
                            학생: <span className="font-mono">kim / 1234</span>
                        </p>
                    </CardFooter>
                </Card>

                <p className="text-center text-sm text-muted-foreground">
                    <Link
                        href="/"
                        className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                        ← 홈으로
                    </Link>
                </p>
            </div>
        </div>
    );
}
