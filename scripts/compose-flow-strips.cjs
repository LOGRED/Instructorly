/**
 * 전체 흐름(플로우) 그림 2장을 합성한다 — 투명 배경 + 검정 라인아트.
 * 새로 만든 라인 아이콘(public/guide/icons/*.png)을 카드에 끼워 넣고, 숫자 뱃지·한글 라벨·
 * 얇은 화살표를 검정 선으로만 그린다. 한글이 정확히 나오도록 puppeteer(Chrome)로 렌더한다.
 * 출력: public/guide/instructor-flow.png, public/guide/student-flow.png
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const ICONS = path.join(ROOT, "public/guide/icons");
const OUT = path.join(ROOT, "public/guide");

// 역할별 5단계: 라벨과 사용할 아이콘 파일명.
const FLOWS = {
    instructor: [
        { label: "강사로 가입", icon: "start" },
        { label: "강좌 만들기", icon: "create-course" },
        { label: "학생 초대", icon: "invite" },
        { label: "강의 만들기", icon: "builder" },
        { label: "진도 확인", icon: "progress" },
    ],
    student: [
        { label: "초대 링크 받기", icon: "invite" },
        { label: "가입·로그인", icon: "start" },
        { label: "강의 듣기", icon: "player" },
        { label: "AI 따라하기", icon: "ai" },
        { label: "작품 자랑", icon: "atelier" },
    ],
};

// 아이콘 PNG를 표시 크기(240px)로 미리 축소해 base64 data URI로 만든다.
// 브라우저가 1254px 원본을 CSS로 줄이면 알파 헤일로(옅은 사각 잔상)가 생기므로,
// sharp(프리멀티플라이드)로 깔끔히 축소한 뒤 끼워 넣어 잔상을 없앤다.
async function iconDataUri(name) {
    const buf = await sharp(path.join(ICONS, `${name}.png`))
        .resize(240, 240, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
}

// 얇은 검정 화살표 SVG(채움 없음).
const ARROW = `<svg class="arrow" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 28 H43 M33 17 L45 28 L33 39" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// 한 역할의 플로우 HTML을 만든다.
async function buildHTML(steps) {
    const uris = await Promise.all(steps.map((s) => iconDataUri(s.icon)));
    const cards = steps
        .map((s, i) => {
            const card = `
            <div class="card">
                <div class="num">${i + 1}</div>
                <img class="icon" src="${uris[i]}" alt="" />
                <div class="label">${s.label}</div>
            </div>`;
            return i < steps.length - 1 ? card + ARROW : card;
        })
        .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: transparent; }
        #strip {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            width: 1920px; padding: 44px 40px;
            font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        }
        .card {
            flex: 1 1 0; max-width: 320px; min-height: 300px;
            border: 2.5px solid #111111; border-radius: 30px; background: transparent;
            display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
            gap: 20px; padding: 30px 16px 26px;
        }
        .num {
            width: 56px; height: 56px; border: 2.5px solid #111111; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 27px; font-weight: 800; color: #111111; line-height: 1;
        }
        .icon { width: 108px; height: 108px; object-fit: contain; }
        .label {
            font-size: 28px; font-weight: 700; color: #111111; text-align: center;
            line-height: 1.25; letter-spacing: -0.6px;
        }
        .arrow { flex: 0 0 auto; width: 52px; height: 52px; }
    </style></head><body><div id="strip">${cards}</div></body></html>`;
}

// 두 역할의 플로우 그림을 렌더해 PNG로 저장한다.
async function main() {
    const browser = await puppeteer.launch({ headless: "new" });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 900, deviceScaleFactor: 2 });
        for (const [role, steps] of Object.entries(FLOWS)) {
            // 데이터 URI라 네트워크가 없으므로 'load'로 충분하다. 이미지 디코딩까지 보장한다.
            await page.setContent(await buildHTML(steps), { waitUntil: "load" });
            await page.evaluate(() =>
                Promise.all(
                    Array.from(document.images).map((img) =>
                        img.complete ? Promise.resolve() : img.decode().catch(() => {}),
                    ),
                ),
            );
            const el = await page.$("#strip");
            const out = path.join(OUT, `${role}-flow.png`);
            await el.screenshot({ path: out, omitBackground: true });
            console.log(`✓ ${role} → ${out}`);
        }
    } finally {
        await browser.close();
    }
}

main().catch((e) => {
    console.error("✗", e);
    process.exit(1);
});
