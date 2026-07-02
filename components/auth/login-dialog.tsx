/**
 * 홈 스플래시의 "입장하기" 버튼 — 누르면 페이지 이동 없이 로그인/회원가입 다이얼로그를 띄운다.
 */
"use client";

import { useState } from "react";

import { AuthForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {BrandLogo} from "../brand-logo";

// 입장하기 버튼과 로그인/회원가입 다이얼로그를 함께 렌더한다.
export function LoginDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="lg" className="mt-10 gap-1.5 py-6 px-10 text-xl" />}>
                입장하기
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">
                        <BrandLogo/>
                    </DialogTitle>
                </DialogHeader>

                <AuthForm onSuccess={() => setOpen(false)} />

                <p className="text-center text-xs text-muted-foreground">
                    데모 계정 — 강사: <span className="font-mono">teacher / 1234</span>,
                    학생: <span className="font-mono">kim / 1234</span>
                </p>
            </DialogContent>
        </Dialog>
    );
}
