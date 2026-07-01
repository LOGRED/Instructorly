/**
 * 랜딩 페이지 눈 일러스트 — 눈동자가 마우스/터치 포인터를 따라 움직이는 클라이언트 컴포넌트.
 */
"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// 눈 소켓 중심(cx,cy)과 눈동자 최대 이동 반경(rx,ry) — 컨테이너 크기 대비 비율.
const EYES = [
    { cx: 0.34, cy: 0.5, rx: 0.09, ry: 0.08 },
    { cx: 0.68, cy: 0.5, rx: 0.09, ry: 0.08 },
] as const;

// 마우스/터치 포인터를 따라 두 눈동자가 움직이는 랜딩 눈 일러스트를 렌더한다.
export function LandingEyes({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pupilRefs = useRef<(HTMLDivElement | null)[]>([]);
    const rafRef = useRef<number | null>(null);
    const pointerRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // 포인터 위치를 기준으로 각 눈동자의 clamp된 이동량을 계산해 transform으로 적용한다.
        const applyPupilPositions = () => {
            rafRef.current = null;
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const { x: px, y: py } = pointerRef.current;

            EYES.forEach((eye, i) => {
                const pupil = pupilRefs.current[i];
                if (!pupil) return;
                const cx = rect.left + eye.cx * rect.width;
                const cy = rect.top + eye.cy * rect.height;
                const dx = px - cx;
                const dy = py - cy;
                const maxRx = eye.rx * rect.width;
                const maxRy = eye.ry * rect.height;
                const angle = Math.atan2(dy, dx);
                // 타원 정규화 거리(0~1)로 clamp해 눈동자가 흰자위 밖으로 나가지 않게 한다.
                const normalized = Math.min(1, Math.hypot(dx / maxRx, dy / maxRy));
                const offsetX = Math.cos(angle) * maxRx * normalized;
                const offsetY = Math.sin(angle) * maxRy * normalized;
                pupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            });
        };

        // 포인터 좌표만 기록하고 실제 DOM 반영은 rAF에서 한 번만 수행한다(리렌더 없음).
        const updatePointer = (x: number, y: number) => {
            pointerRef.current = { x, y };
            if (rafRef.current !== null) return;
            rafRef.current = requestAnimationFrame(applyPupilPositions);
        };

        const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) updatePointer(touch.clientX, touch.clientY);
        };

        window.addEventListener("mousemove", onMouseMove, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("touchmove", onTouchMove);
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div ref={containerRef} className={`relative aspect-square ${className ?? ""}`}>
            <Image
                src="/landing-eyes.png"
                alt=""
                fill
                priority
                sizes="176px"
                className="pointer-events-none select-none"
            />
            {EYES.map((eye, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        pupilRefs.current[i] = el;
                    }}
                    className="eye-pupil absolute rounded-full bg-black"
                    style={{
                        left: `${eye.cx * 100}%`,
                        top: `${eye.cy * 100}%`,
                        width: "16%",
                        height: "16%",
                        marginLeft: "-8%",
                        marginTop: "-8%",
                    }}
                >
                    <span
                        className="absolute rounded-full bg-white"
                        style={{ width: "30%", height: "30%", top: "16%", left: "54%" }}
                    />
                </div>
            ))}
        </div>
    );
}
