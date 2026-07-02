/**
 * 홈 랜딩 페이지 — 장식을 걷어낸 미니멀 입장 스플래시. 눈 일러스트 + 브랜드명 + 한 줄 소개 + 입장 다이얼로그만 남긴다.
 */
import { LandingEyes } from "@/components/landing-eyes";
import { LoginDialog } from "@/components/auth/login-dialog";

// 입장하기 느낌만 남긴 미니멀 스플래시 페이지를 렌더한다.
export default function HomePage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
            <LandingEyes className="mb-8 w-[140px] sm:w-[176px]" />
            <p className="eyebrow tracking-[0.2em]">INSTRUCTORLY</p>
            <p className="mt-5 max-w-2xl text-2xl leading-relaxed text-muted-foreground">
                누구나 AI 강사가 되는 학습 플랫폼. 블럭으로 강의를 만들고,
                페이지를 넘기며 배우고, 결과물을 자랑하세요.
            </p>
            <LoginDialog />
        </div>
    );
}
