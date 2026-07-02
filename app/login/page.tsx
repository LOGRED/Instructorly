/**
 * 로그인/회원가입 페이지 — 실제 폼은 공용 AuthForm을 그대로 쓰는 얇은 페이지 래퍼.
 */
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { AuthForm } from "@/components/auth/login-form";
import {
    Card,
    CardHeader,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

export default function LoginPage() {
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
                        <AuthForm />
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
