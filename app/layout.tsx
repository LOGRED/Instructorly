/**
 * 루트 레이아웃 — 전역 Provider·폰트·메타데이터를 적용하고, 첫 페인트 전에
 * 저장된 접근성·화면 설정(글자 크기·UI 크기·고대비·모서리 둥글기)을 <html>에 미리 반영해 깜빡임을 막는다.
 */
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
    title: "Instructorly — 누구나 AI 강사",
    description:
        "AI 강사를 만들고 가르치는 가장 쉬운 방법. 이미지·동영상·AI 블럭으로 강의를 만들고, 페이지를 넘기며 배웁니다.",
};

// Apply saved accessibility prefs before first paint to avoid a flash.
const NO_FLASH = `(function(){try{var raw=localStorage.getItem('maketor-prefs');if(!raw)return;var p=(JSON.parse(raw).state)||{};var e=document.documentElement;if(p.fontScale&&p.fontScale!=='base')e.setAttribute('data-font-scale',p.fontScale);if(p.uiScale&&p.uiScale!=='base')e.setAttribute('data-ui-scale',p.uiScale);if(p.contrast)e.setAttribute('data-contrast','high');if(p.cornerRadius&&p.cornerRadius!=='base')e.setAttribute('data-corner-radius',p.cornerRadius);}catch(_){}})();`;

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="ko"
            suppressHydrationWarning
            className={`${GeistMono.variable} h-full`}
        >
            <head>
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
                />
                <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
            </head>
            <body className="min-h-full bg-background text-foreground antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
