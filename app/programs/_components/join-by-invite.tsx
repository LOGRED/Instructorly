/**
 * 초대 코드로 강좌 참여 다이얼로그 — 학생이 강사에게 받은 초대 코드를 입력해 강좌에 참여하는 클라이언트 컴포넌트.
 */
"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { joinByInvite } from "@/lib/api";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JoinByInviteProps {
    userId: string;
    onJoined: () => void;
}

// 초대 코드로 강좌 참여 다이얼로그 컴포넌트.
export function JoinByInvite({ userId, onJoined }: JoinByInviteProps) {
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);

    // 다이얼로그가 닫힐 때 입력값을 초기화한다.
    function handleOpenChange(next: boolean) {
        if (loading) return;
        setOpen(next);
        if (!next) setCode("");
    }

    // 초대 코드로 강좌에 참여하고 목록을 갱신한다.
    async function handleJoin() {
        if (!code.trim()) {
            toast.error("초대 코드를 입력해 주세요.");
            return;
        }
        setLoading(true);
        try {
            await joinByInvite(code.trim(), userId);
            toast.success("강좌에 참여했습니다.");
            setOpen(false);
            setCode("");
            onJoined();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "참여에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="lg" />}>
                <LogIn />
                초대 코드로 참여
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>초대 코드로 강좌 참여</DialogTitle>
                    <DialogDescription>
                        강사에게 받은 초대 코드를 입력하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="invite-code">초대 코드</Label>
                        <Input
                            id="invite-code"
                            placeholder="초대 코드를 입력하세요"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={loading}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleJoin();
                            }}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline" size="lg" disabled={loading} />}>
                        취소
                    </DialogClose>
                    <Button size="lg" onClick={handleJoin} disabled={loading}>
                        {loading ? "참여 중..." : "참여하기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
