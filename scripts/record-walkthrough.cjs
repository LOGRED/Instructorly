/**
 * 설명서용 워크스루 영상(FHD 1920×1080)을 자동 녹화한다.
 * 화면에 '움직이는 가짜 커서'를 띄워 버튼으로 미끄러지듯 이동→클릭하는 모습을 보여 주고,
 * page.screencast 로 페이지를 그대로 녹화(headless, 깔끔·배너 없음) → ffmpeg 로 mp4 변환.
 * 지금은 샘플 한 장면('새 강좌 만들기')만. 결과: /tmp/guide-proof/sample-create-course.mp4
 * 실행:  node scripts/record-walkthrough.cjs
 */
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const puppeteer = require(path.join(process.cwd(), "node_modules", "puppeteer"));

const BASE = "http://localhost:3000";
const OUT = path.join(os.tmpdir(), "guide-proof");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 화면에 가짜 커서(점)를 띄운다. 부드럽게 움직이도록 transition 을 건다.
async function installCursor(page) {
    await page.evaluate(() => {
        const c = document.createElement("div");
        c.id = "__fakecur";
        Object.assign(c.style, {
            position: "fixed", left: "0px", top: "0px", width: "26px", height: "26px",
            zIndex: "2147483647", pointerEvents: "none",
            transform: "translate(-3px,-3px)", transition: "left .7s cubic-bezier(.4,0,.2,1), top .7s cubic-bezier(.4,0,.2,1)",
        });
        c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3l14 7-6 1.5L9.5 18 5 3z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        document.body.appendChild(c);
        const r = document.createElement("div");
        r.id = "__fakering";
        Object.assign(r.style, {
            position: "fixed", left: "0px", top: "0px", width: "8px", height: "8px", borderRadius: "50%",
            background: "rgba(37,99,235,.45)", zIndex: "2147483646", pointerEvents: "none",
            transform: "translate(-50%,-50%) scale(0)", transition: "transform .35s ease, opacity .35s ease", opacity: "0",
        });
        document.body.appendChild(r);
        window.__cur = { x: 0, y: 0 };
    });
}

// 가짜 커서를 (x,y)로 이동시키고 멈춘다.
async function cursorTo(page, x, y) {
    await page.evaluate((x, y) => {
        const c = document.getElementById("__fakecur");
        if (c) { c.style.left = x + "px"; c.style.top = y + "px"; }
        window.__cur = { x, y };
    }, x, y);
    await sleep(850);
}

// 클릭 물결 효과를 현재 커서 위치에서 보여 준다.
async function clickPulse(page) {
    await page.evaluate(() => {
        const { x, y } = window.__cur || { x: 0, y: 0 };
        const r = document.getElementById("__fakering");
        if (!r) return;
        r.style.left = x + "px"; r.style.top = y + "px";
        r.style.transition = "none"; r.style.transform = "translate(-50%,-50%) scale(0)"; r.style.opacity = "1";
        void r.offsetWidth;
        r.style.transition = "transform .4s ease, opacity .4s ease";
        r.style.transform = "translate(-50%,-50%) scale(6)"; r.style.opacity = "0";
    });
    await sleep(300);
}

// 텍스트/placeholder 로 요소 중심 좌표를 구한다(화면 안으로 스크롤).
async function locate(page, { text, placeholder, role, dialog }) {
    return page.evaluate(({ text, placeholder, role, dialog }) => {
        const root = dialog ? document.querySelector('[role="dialog"]') || document : document;
        let el = null;
        if (placeholder) el = [...root.querySelectorAll("input,textarea")].find((e) => (e.placeholder || "").includes(placeholder));
        else if (role) el = [...root.querySelectorAll(`[role="${role}"]`)].find((e) => e.textContent.includes(text));
        else el = [...root.querySelectorAll("button,a")].find((e) => e.textContent.trim() === text) || [...root.querySelectorAll("button,a")].find((e) => e.textContent.includes(text));
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, { text, placeholder, role, dialog });
}

// 요소로 커서 이동 → 클릭(물결 + 실제 클릭).
async function moveClick(page, locator) {
    const p = await locate(page, locator);
    if (!p) { console.log("  · 못 찾음:", JSON.stringify(locator)); return false; }
    await cursorTo(page, p.x, p.y);
    await clickPulse(page);
    await page.mouse.click(p.x, p.y);
    await sleep(400);
    return true;
}

// 로그인(녹화 시작 전, 화면 밖 작업).
async function login(page, id, pw) {
    await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("#login-id", { timeout: 10000 });
    await page.type("#login-id", id, { delay: 10 });
    await page.type("#login-pw", pw, { delay: 10 });
    await page.evaluate(() => { const el = [...document.querySelectorAll('button:not([role="tab"])')].find((b) => b.textContent.trim() === "로그인"); if (el) el.click(); });
    await page.waitForFunction(() => { try { const r = JSON.parse(localStorage.getItem("maketor-identity") || "{}"); return !!(r.state && r.state.role); } catch { return false; } }, { timeout: 12000 });
    await sleep(600);
}

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        args: ["--no-sandbox", "--window-size=1920,1080", "--force-device-scale-factor=1", "--hide-scrollbars"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    await login(page, "hongmun", "1234");
    await page.goto(BASE + "/programs", { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.body.innerText.includes("강좌 목록"), { timeout: 12000 }).catch(() => {});
    await sleep(800);
    await installCursor(page);
    await cursorTo(page, 960, 560); // 가운데서 시작

    const webm = path.join(OUT, "sample-create-course.webm");
    const mp4 = path.join(OUT, "sample-create-course.mp4");
    const recorder = await page.screencast({ path: webm });

    // ── 장면: 새 강좌 만들기 ──
    await sleep(1000);
    await moveClick(page, { text: "새 강좌 만들기" });
    await sleep(700);
    await installCursor(page); // 다이얼로그가 새로 그려질 수 있어 커서 재설치
    await moveClick(page, { placeholder: "", dialog: true }); // 제목 input(첫 입력칸) — placeholder 없을 수 있어 아래서 보강
    // 제목 입력
    await page.evaluate(() => { const i = document.querySelector('[role="dialog"] input'); if (i) i.focus(); });
    await cursorTo(page, 960, 360);
    await page.type('[role="dialog"] input', "스마트폰으로 사진 잘 찍기", { delay: 55 });
    await sleep(500);
    // 설명 입력
    await page.evaluate(() => { const t = document.querySelector('[role="dialog"] textarea'); if (t) { t.scrollIntoView({ block: "center" }); t.focus(); } });
    await cursorTo(page, 960, 470);
    await clickPulse(page);
    await page.type('[role="dialog"] textarea', "스마트폰 카메라로 일상을 예쁘게 담는 방법을 배웁니다.", { delay: 28 });
    await sleep(500);
    // 요일 '화'
    await moveClick(page, { text: "화", dialog: true });
    await sleep(500);
    // 만들기 단추로 커서 이동(완료 직전 강조; 실제 생성은 안 함)
    const mk = await locate(page, { text: "만들기", dialog: true });
    if (mk) { await cursorTo(page, mk.x, mk.y); await clickPulse(page); }
    await sleep(1200);

    await recorder.stop();
    await browser.close();

    // webm → mp4 (FHD 보장, h264)
    execFileSync("ffmpeg", ["-y", "-i", webm, "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", mp4], { stdio: "ignore" });
    // 확인용 프레임 3장
    for (const [t, n] of [["1.5", "f1"], ["6", "f2"], ["11", "f3"]]) {
        try { execFileSync("ffmpeg", ["-y", "-ss", t, "-i", mp4, "-frames:v", "1", path.join(OUT, `cc-${n}.png`)], { stdio: "ignore" }); } catch {}
    }
    const sz = fs.statSync(mp4).size;
    const dim = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", mp4]).toString().trim();
    console.log("완료:", mp4, "\n해상도/길이:", dim, "\n크기:", Math.round(sz / 1024) + "KB");
}
main().catch((e) => { console.error(e); process.exit(1); });
