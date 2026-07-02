/**
 * 창작 실습 결과물 PDF 내보내기 — '책' 페이지 DOM을 한 장씩 캡처해 PDF로 합친다.
 *
 * Tailwind v4가 색을 oklch()로 내보내므로, 그걸 처리하는 html2canvas-pro(oklch 지원 포크)를
 * 쓴다. jspdf·html2canvas-pro는 브라우저 전용이라 동적 import로 클라이언트에서만 로드한다
 * (서버 번들에 끌려 들어가지 않도록).
 */

import type { PageRatio } from "./atelier-templates";

/** 종횡비 키 → pt 단위 [가로, 세로] (A4 = 595.28 × 841.89pt). */
function ratioToPt(ratio: PageRatio): [number, number] {
    switch (ratio) {
        case "square":
            return [595.28, 595.28];
        case "wide":
        case "a4l":
            return [841.89, 595.28];
        case "r4_3":
            return [800, 600];
        case "r3_4":
            return [600, 800];
        case "a4":
        default:
            return [595.28, 841.89];
    }
}

/** 책 페이지 노드들을 캡처해 PDF 파일로 저장한다(pages[0]가 표지). */
export async function exportAtelierPdf(opts: {
    /** 캡처할 페이지 DOM 노드들(표지 → 본문 순서). */
    pages: HTMLElement[];
    /** 저장 파일명(.pdf 포함). */
    fileName: string;
    /** 페이지 종횡비. */
    ratio: PageRatio;
}): Promise<void> {
    const { pages, fileName, ratio } = opts;
    if (!pages.length) throw new Error("내보낼 페이지가 없습니다.");

    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas-pro")).default;

    const [pw, ph] = ratioToPt(ratio);
    const orientation: "portrait" | "landscape" = pw > ph ? "landscape" : "portrait";
    const pdf = new jsPDF({ unit: "pt", format: [pw, ph], orientation });

    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
            scale: 2, // 선명하게(고해상도 캡처)
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage([pw, ph], orientation);

        // 비율을 유지한 채 페이지에 꽉 차게(contain) 배치하고 가운데 정렬한다.
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * scale;
        const h = canvas.height * scale;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(imgData, "JPEG", x, y, w, h);
    }

    pdf.save(fileName);
}

/** 제목으로 안전한 PDF 파일명을 만든다(못 쓰는 문자 제거, 한글 유지). */
export function pdfFileName(title: string): string {
    const cleaned = title
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
    return `${cleaned || "작품"}.pdf`;
}
