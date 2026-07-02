/**
 * 사용 설명서(/guide)용 '사용 방법' 워크스루 영상(FHD 1920×1080)을 섹션마다 한 편씩 자동 녹화한다.
 *
 * 화면에 '움직이는 가짜 커서'를 띄워 버튼으로 미끄러지듯 이동→클릭하는 모습을 보여 주고,
 * page.screencast 로 페이지를 그대로 녹화(headless) → ffmpeg 로 mp4(H.264) 변환 →
 * public/guide/videos/{role}-{섹션id}.mp4 로 저장한다. 그러면 설명서의 'GuideVideo' 자리에서 바로 재생된다.
 *
 * 시나리오(어떤 버튼을 누르는지)는 capture-step-shots.cjs 의 검증된 셀렉터/순서를 그대로 옮겨 왔다.
 * AI '실행' 단추는 '커서로 강조만' 하고 누르지 않는다(실제 생성=과금 방지).
 *
 * 사전: 개발 서버가 http://localhost:3000 에서 실행 중 + 데모 시드(seed-demo-hongmun) 적용됨.
 * 실행:
 *   node scripts/record-guide-videos.cjs            # 전체 26편
 *   node scripts/record-guide-videos.cjs pilot      # 파일럿(강사 create-course, invite 2편)
 *   node scripts/record-guide-videos.cjs instructor # 강사 15편만
 *   node scripts/record-guide-videos.cjs student     # 학생 11편만
 *   node scripts/record-guide-videos.cjs instructor:invite,student:chat   # 콕 집어서
 */
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const puppeteer = require(path.join(process.cwd(), "node_modules", "puppeteer"));

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "guide", "videos");
const TMP = path.join(os.tmpdir(), "guide-videos");
const HUB = "/programs/hongmun-ai-2026";
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 };
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 화면에 가짜 커서(점)와 클릭 물결을 띄운다. 부드럽게 움직이도록 transition 을 건다. (DOM 새로 그려지면 다시 부른다)
async function installCursor(page) {
    await page.evaluate(() => {
        document.getElementById("__fakecur")?.remove();
        document.getElementById("__fakering")?.remove();
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

// 가짜 커서를 (x,y)로 미끄러뜨리고 멈춘다.
async function cursorTo(page, x, y) {
    await page.evaluate((x, y) => {
        const c = document.getElementById("__fakecur");
        if (c) { c.style.left = x + "px"; c.style.top = y + "px"; }
        window.__cur = { x, y };
    }, x, y);
    await sleep(820);
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

// 텍스트/role 로 요소 중심 좌표를 구한다(화면 안으로 스크롤). dialog:true 면 열린 대화상자 안에서만 찾는다.
async function locate(page, { text, role, nth = 0, dialog = false }) {
    return page.evaluate(({ text, role, nth, dialog }) => {
        const root = dialog ? document.querySelector('[role="dialog"]') || document : document;
        const sel = role ? `[role="${role}"]` : 'button, a, [role="tab"], [role="menuitem"], [role="button"]';
        const all = [...root.querySelectorAll(sel)];
        const exact = all.filter((e) => e.textContent.trim() === text || e.getAttribute("aria-label") === text);
        let el = exact[nth] || all.filter((e) => e.textContent.includes(text) || (e.getAttribute("aria-label") || "").includes(text))[nth];
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, { text, role, nth, dialog });
}

// 요소로 커서를 옮기고 물결을 띄운 뒤, click=true 면 실제로 누른다. (무거운 화면 대비 한 번 재시도)
async function moveTo(page, locator, click) {
    let p = await locate(page, locator);
    if (!p) { await sleep(1000); p = await locate(page, locator); }
    if (!p) { await sleep(1300); p = await locate(page, locator); }
    if (!p) { console.log("    · 못 찾음:", JSON.stringify(locator)); return false; }
    await cursorTo(page, p.x, p.y);
    await clickPulse(page);
    if (click) { await page.mouse.click(p.x, p.y); await sleep(450); }
    else await sleep(250);
    return true;
}

// CSS 셀렉터로 입력칸에 진짜 키 입력을 한다(커서도 그 위치로 옮겨 클릭 물결을 보여 준다).
async function typeInto(page, sel, text) {
    const box = await page.evaluate((sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        e.scrollIntoView({ block: "center" });
        e.focus();
        const r = e.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, sel);
    if (!box) { console.log("    · 입력칸 못 찾음:", sel); return; }
    await cursorTo(page, box.x, box.y);
    await clickPulse(page);
    await page.type(sel, text, { delay: 42 });
    await sleep(450);
}

// '강사'/'학생' 역할 카드를 누른다(회원가입 화면 전용).
async function clickRoleCard(page, kind) {
    const box = await page.evaluate((kind) => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.replace(/\s+/g, "").includes(kind + "강의를"));
        if (!b) return null;
        b.scrollIntoView({ block: "center" });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, kind);
    if (!box) { console.log("    · 역할 카드 못 찾음:", kind); return; }
    await cursorTo(page, box.x, box.y);
    await clickPulse(page);
    await page.mouse.click(box.x, box.y);
    await sleep(450);
}

// 글자가 들어간 첫 요소를 화면 위쪽으로 스크롤한다.
async function scrollToText(page, text, offset = 150) {
    await page.evaluate((text, offset) => {
        const el = [...document.querySelectorAll("body *")].find((e) => e.children.length < 6 && (e.textContent || "").includes(text));
        if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset), behavior: "smooth" });
    }, text, offset);
    await sleep(750);
}

// 기대 글자가 나타나고 로딩 골격(.animate-pulse)이 사라질 때까지 기다린다.
async function waitReady(page, waitText) {
    if (waitText) {
        await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout: 15000 }, waitText).catch(() => {});
    }
    await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 8000 }).catch(() => {});
}

// 아이디/비밀번호로 로그인한다(녹화 시작 전, 화면 밖 작업). 성공할 때까지 3번 시도.
async function login(page, id, pw) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.goto(BASE + "/login", { waitUntil: "networkidle2" }).catch(() => {});
        const has = await page.waitForSelector("#login-id", { timeout: 12000 }).then(() => true).catch(() => false);
        if (!has) { console.log("   로그인 폼 안 뜸, 재시도", attempt, "—", id); await sleep(900); continue; }
        await sleep(300);
        await page.click("#login-id", { clickCount: 3 }).catch(() => {});
        await page.type("#login-id", id, { delay: 12 }).catch(() => {});
        await page.click("#login-pw", { clickCount: 3 }).catch(() => {});
        await page.type("#login-pw", pw, { delay: 12 }).catch(() => {});
        await page.evaluate(() => { const el = [...document.querySelectorAll('button:not([role="tab"])')].find((b) => b.textContent.trim() === "로그인"); if (el) el.click(); });
        const ok = await page.waitForFunction(() => {
            try { const r = JSON.parse(localStorage.getItem("maketor-identity") || "{}"); return !!(r.state && r.state.role); } catch { return false; }
        }, { timeout: 12000 }).then(() => true).catch(() => false);
        if (ok) {
            await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
            await sleep(700);
            return true;
        }
        console.log("   로그인 재시도", attempt, "—", id);
    }
    console.log("   ✗ 로그인 실패:", id);
    return false;
}

// 어떤 확인창이 떠도 자동으로 '확인'을 눌러 이동이 막히지 않게 한다(저장 안 한 변경 경고 포함).
function autoAcceptDialogs(page) {
    page.on("dialog", async (d) => { try { await d.accept(); } catch {} });
}

// 한 액션을 실행한다. 액션은 [동작, ...인자] 배열.
async function runAct(page, act) {
    const [kind, a1, a2, a3] = act;
    switch (kind) {
        case "click": return moveTo(page, typeof a1 === "string" ? { text: a1, ...(a2 || {}) } : a1, true);
        case "hover": return moveTo(page, typeof a1 === "string" ? { text: a1, ...(a2 || {}) } : a1, false);
        case "type": return typeInto(page, a1, a2);
        case "role": return clickRoleCard(page, a1);
        case "scroll": return scrollToText(page, a1, a2 || 150);
        case "key": await page.keyboard.press(a1).catch(() => {}); return sleep(400);
        case "pause": return sleep(a1);
        case "goto":
            await page.evaluate(() => { try { window.onbeforeunload = null; } catch {} }).catch(() => {});
            await page.goto(BASE + a1, { waitUntil: a3 === "dom" ? "domcontentloaded" : "networkidle2", timeout: 30000 });
            await waitReady(page, a2);
            await sleep(a3 === "dom" ? 1800 : 700);
            await installCursor(page);
            await cursorTo(page, 960, 540);
            return sleep(250);
        default: return;
    }
}

// 한 섹션 영상을 녹화한다: 시작 화면으로 가서 커서를 설치하고, screencast 를 켠 뒤 액션들을 시연하고, mp4 로 변환한다.
// 섹션 시작 화면으로 가서 커서를 설치하고 화면을 안정화한다(녹화 직전 공통 준비).
async function gotoAndPrep(page, sec) {
    await page.evaluate(() => { try { window.onbeforeunload = null; } catch {} }).catch(() => {});
    await page.goto(BASE + sec.url, { waitUntil: sec.dom ? "domcontentloaded" : "networkidle2", timeout: 30000 });
    await waitReady(page, sec.wait);
    await sleep(sec.dom ? 2400 : 900);
    await installCursor(page);
    await cursorTo(page, 960, 540);
    await sleep(400);
}

// 변환 결과(mp4)의 해상도·길이·크기를 한 줄로 출력한다.
function logResult(name, mp4, suffix) {
    const sz = fs.statSync(mp4).size;
    const dim = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", mp4]).toString().trim();
    console.log(`  ✓ ${name}${suffix || ""}  (${dim}, ${Math.round(sz / 1024)}KB)`);
}

async function recordSection(page, role, sec) {
    const name = `${role}-${sec.id}`;
    const mp4 = path.join(OUT, name + ".mp4");
    try {
        await gotoAndPrep(page, sec);

        const webm = path.join(TMP, name + ".webm");
        const recorder = await page.screencast({ path: webm });
        await sleep(700);

        for (const act of sec.acts) await runAct(page, act);
        await sleep(1100);

        await recorder.stop();
        await sleep(700); // webm 이 끝까지 기록(flush)될 때까지 대기

        // 일부 페이지는 page.screencast 가 프레임을 못 남겨 0바이트가 된다 → 스크린샷 슬라이드로 폴백.
        if (!fs.existsSync(webm) || fs.statSync(webm).size < 1024) {
            fs.rmSync(webm, { force: true });
            console.log(`  ⚠ ${name} 화면 녹화 빈 파일 → 스크린샷 슬라이드로 재시도`);
            return recordViaShots(page, role, sec, mp4);
        }

        // webm → mp4 (FHD 보장, h264, 브라우저 바로 재생)
        execFileSync("ffmpeg", ["-y", "-i", webm, "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-movflags", "+faststart", mp4], { stdio: "ignore" });
        fs.rmSync(webm, { force: true });
        logResult(name, mp4);
        return true;
    } catch (e) {
        console.log(`  ✗ ${name} — ${e.message}`);
        return false;
    }
}

// page.screencast 가 안 되는 페이지용 폴백: 액션을 다시 수행하며 단계마다 스크린샷을 찍어 슬라이드 영상으로 합성한다.
async function recordViaShots(page, role, sec, mp4) {
    const name = `${role}-${sec.id}`;
    try {
        await gotoAndPrep(page, sec);
        const dir = path.join(TMP, name + "-shots");
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        let i = 0;
        // 같은 장면을 hold 장 찍어 그 화면이 영상에서 더 오래 머물게 한다.
        const snap = async (hold = 2) => {
            for (let k = 0; k < hold; k++) await page.screenshot({ path: path.join(dir, String(i++).padStart(4, "0") + ".png") });
        };
        await snap(3);
        for (const act of sec.acts) { await runAct(page, act); await snap(2); }
        await snap(3);

        // 프레임들을 슬라이드 영상으로 (각 프레임 ≈0.67초, 30fps 출력)
        execFileSync("ffmpeg", ["-y", "-framerate", "1.5", "-i", path.join(dir, "%04d.png"), "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-r", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], { stdio: "ignore" });
        fs.rmSync(dir, { recursive: true, force: true });
        logResult(name, mp4, " (슬라이드)");
        return true;
    } catch (e) {
        console.log(`  ✗ ${name} (슬라이드) — ${e.message}`);
        return false;
    }
}

// FHD 브라우저 하나를 띄운다.
async function launchBrowser() {
    return puppeteer.launch({
        headless: "new",
        defaultViewport: VIEWPORT,
        args: ["--no-sandbox", "--window-size=1920,1080", "--force-device-scale-factor=1", "--hide-scrollbars"],
    });
}

// 한 역할(강사/학생)의 섹션들을 '독립 브라우저'에서 녹화한다(컨텍스트를 닫고 다시 여는 충돌을 피한다).
async function recordRole(role, id, secs) {
    if (!secs.length) return { ok: 0, fail: 0 };
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    autoAcceptDialogs(page);
    await login(page, id, "1234");
    console.log(`─ ${role}(${id}) 녹화 ─`);
    let ok = 0, fail = 0;
    for (const s of secs) (await recordSection(page, role, s)) ? ok++ : fail++;
    await browser.close();
    return { ok, fail };
}

// 회원가입(가입·로그인) 영상은 로그인 안 한 자체 브라우저에서 녹화한다.
async function recordSignup(role) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    autoAcceptDialogs(page);
    const kind = role === "instructor" ? "강사" : "학생";
    const idText = role === "instructor" ? "hong_sam" : "kim_young";
    const nameText = role === "instructor" ? "홍길동 강사" : "김영희";
    const sec = {
        id: "start", url: "/login", wait: "로그인",
        acts: [
            ["click", "회원가입", { role: "tab" }], ["pause", 600],
            ["type", "#reg-id", idText],
            ["type", "#reg-pw", "1234"],
            ["type", "#reg-name", nameText],
            ["role", kind], ["pause", 500],
            ["hover", "회원가입", { nth: 1 }], ["pause", 700],
        ],
    };
    console.log(`─ ${role} 가입 녹화 ─`);
    const ok = await recordSection(page, role, sec);
    await browser.close();
    return ok;
}

// ── 강사(hongmun) 섹션 시나리오 — README/guide-data 의 파일 이름(id)에 1:1 대응 ──
const INSTRUCTOR = [
    {
        id: "create-course", url: "/programs", wait: "강좌 목록",
        acts: [
            ["click", "새 강좌 만들기"], ["pause", 700],
            ["type", '[role="dialog"] input', "스마트폰으로 사진 잘 찍기"],
            ["type", '[role="dialog"] textarea', "스마트폰 카메라로 일상을 예쁘게 담는 방법을 배웁니다."],
            ["click", { text: "화", dialog: true }], ["pause", 400],
            ["hover", { text: "만들기", dialog: true }], ["pause", 900],
        ],
    },
    {
        id: "invite", url: HUB, wait: "수강생 등록",
        acts: [
            ["pause", 1200],
            ["scroll", "수강생 등록", 240], ["pause", 700],
            ["hover", "수강생 등록"], ["pause", 800],
            ["click", { text: "수강생 명단", role: "tab" }], ["pause", 900],
            ["scroll", "내보내기", 200], ["pause", 800],
        ],
    },
    {
        id: "weeks", url: HUB, wait: "강의 추가",
        acts: [
            ["scroll", "주차 추가"], ["pause", 700],
            ["click", "주차 관리"], ["pause", 700], ["key", "Escape"],
            ["scroll", "강의 추가"], ["pause", 700],
            ["hover", "강의 추가"], ["pause", 600],
        ],
    },
    {
        id: "builder", url: "/build/hm-w01", wait: "페이지 추가", dom: true,
        acts: [
            ["scroll", "블럭 추가", 90], ["pause", 700],
            ["scroll", "강조 박스", 200], ["pause", 700],
            ["hover", "미리보기"], ["pause", 600],
            ["click", "미리보기"], ["pause", 1000],
        ],
    },
    {
        id: "blocks", url: "/build/hm-w01", wait: "블럭 추가", dom: true,
        acts: [
            ["scroll", "블럭 추가", 90], ["pause", 700],
            ["click", "AI"], ["pause", 900],
            ["hover", "AI 글쓰기"], ["pause", 800],
        ],
    },
    {
        id: "ai-content", url: "/build/hm-w01", wait: "AI에게 인사해 보기", dom: true,
        acts: [
            ["pause", 1000],
            ["click", "AI에게 인사해 보기"], ["pause", 900],
            ["scroll", "AI 글쓰기", 120], ["pause", 700],
            ["scroll", "실행", 260], ["pause", 600],
            ["hover", "실행"], ["pause", 800],
            ["scroll", "고정", 200], ["pause", 700],
        ],
    },
    {
        id: "posts", url: HUB, wait: "게시물 추가",
        acts: [
            ["scroll", "게시물 추가"], ["pause", 700],
            ["hover", "게시물 추가"], ["pause", 800],
        ],
    },
    {
        id: "announcements", url: HUB, wait: "공지 추가",
        acts: [
            ["scroll", "공지 추가"], ["pause", 700],
            ["hover", "공지 추가"], ["pause", 800],
        ],
    },
    {
        id: "drills", url: HUB, wait: "시험 추가",
        acts: [
            ["pause", 1200],
            ["scroll", "시험 추가", 240], ["pause", 600],
            ["click", { text: "시험 추가", nth: 0 }], ["pause", 1000],
            ["scroll", "어떤 AI 화면", 120], ["pause", 600],
            ["type", '[role="dialog"] textarea', "‘누가·무엇을·어떻게’가 들어간 질문을 하나 만들어 AI에게 물어보세요."],
            ["pause", 700], ["key", "Escape"],
        ],
    },
    {
        id: "atelier", url: "/atelier/hm-atelier-w03", wait: "기본 설정",
        acts: [
            ["scroll", "표지", 130], ["pause", 700],
            ["scroll", "색 테마", 130], ["pause", 700],
            ["hover", "PDF"], ["pause", 800],
        ],
    },
    {
        id: "roster", url: HUB, wait: "수강생 등록",
        acts: [
            ["pause", 1500],
            ["click", { text: "수강생 명단", role: "tab" }], ["pause", 2200],
            ["scroll", "내보내기", 200], ["pause", 1000],
        ],
    },
    {
        id: "progress", url: HUB, wait: "수강 현황 요약",
        acts: [
            ["scroll", "수강 현황 요약", 120], ["pause", 700],
            ["click", { text: "수강생", nth: 0 }], ["pause", 1200],
        ],
    },
    {
        id: "studio", url: "/studio", wait: "스튜디오",
        acts: [
            ["pause", 700], ["scroll", "사용량", 150], ["pause", 800],
        ],
    },
    {
        id: "settings", url: "/settings", wait: "설정",
        acts: [
            ["click", { text: "설정", role: "tab" }], ["pause", 700],
            ["scroll", "글자 크기", 150], ["pause", 800],
        ],
    },
];

// ── 학생(gildong) 섹션 시나리오 ──
const STUDENT = [
    {
        id: "join", url: "/programs", wait: "내 강좌",
        acts: [
            ["pause", 600], ["scroll", "초대 코드로 참여", 200], ["pause", 800],
            ["hover", "초대 코드로 참여"], ["pause", 700],
        ],
    },
    {
        id: "player", url: "/learn/hm-w01", wait: "다음",
        acts: [
            ["pause", 700], ["hover", "다음"], ["click", "다음"], ["pause", 800],
            ["click", "다음"], ["pause", 900],
        ],
    },
    {
        id: "ai-blocks", url: "/learn/hm-w01", wait: "실행",
        acts: [
            ["pause", 1000],
            ["scroll", "실행", 280], ["pause", 800],
            ["hover", "실행"], ["pause", 900],
            ["scroll", "이미지", 200], ["pause", 700],
        ],
    },
    {
        id: "chat", url: "/learn/hm-w01", wait: "다음",
        acts: [
            ["pause", 1000],
            ["type", 'textarea[placeholder*="메시지"]', "오늘 만든 그림이에요! 봐 주세요 😊"],
            ["pause", 500],
            ["hover", "작품 가져오기"], ["pause", 700],
            ["hover", "전송"], ["pause", 700],
        ],
    },
    {
        id: "atelier", url: "/atelier/hm-atelier-w03", wait: "기본 설정",
        acts: [
            ["scroll", "표지", 130], ["pause", 700],
            ["scroll", "색 테마", 130], ["pause", 700],
            ["hover", "PDF"], ["pause", 800],
        ],
    },
    {
        id: "drills", url: "/drill/hm-drill-w02", wait: null,
        acts: [
            ["pause", 1500], ["scroll", "새 채팅", 150], ["pause", 700],
            ["hover", "새 채팅"], ["pause", 800],
        ],
    },
    {
        id: "posts", url: "/posts/hm-post-intro", wait: "댓글",
        acts: [
            ["pause", 600], ["scroll", "댓글", 200], ["pause", 700],
            ["scroll", "답글", 250], ["pause", 800],
        ],
    },
    {
        id: "studio", url: "/studio", wait: "스튜디오",
        acts: [
            ["pause", 700], ["scroll", "사용량", 150], ["pause", 800],
        ],
    },
    {
        id: "progress", url: HUB, wait: "내 수강 현황",
        acts: [
            ["scroll", "내 수강 현황", 120], ["pause", 800],
        ],
    },
    {
        id: "settings", url: "/settings", wait: "설정",
        acts: [
            ["click", { text: "설정", role: "tab" }], ["pause", 700],
            ["scroll", "글자 크기", 150], ["pause", 800],
        ],
    },
];

// 인자(필터)에 맞는 섹션만 고른다. pilot=강사 2편, instructor/student=역할별, "role:id,role:id"=콕 집기.
function pick(filter) {
    const tag = (role, sec) => ({ role, sec });
    const all = [
        ...INSTRUCTOR.map((s) => tag("instructor", s)),
        ...STUDENT.map((s) => tag("student", s)),
    ];
    const signup = [tag("instructor", { id: "start", signup: true }), tag("student", { id: "start", signup: true })];
    const full = [...signup, ...all];

    if (!filter) return full;
    if (filter === "pilot") return [tag("instructor", INSTRUCTOR.find((s) => s.id === "create-course")), tag("instructor", INSTRUCTOR.find((s) => s.id === "invite"))];
    if (filter === "instructor") return full.filter((x) => x.role === "instructor");
    if (filter === "student") return full.filter((x) => x.role === "student");
    // "role:id,role:id"
    const wanted = new Set(filter.split(",").map((s) => s.trim()));
    return full.filter((x) => wanted.has(`${x.role}:${x.sec.id}`));
}

// 전체 녹화를 수행한다. 강사·학생·가입을 각각 '독립 브라우저'에서 찍어 컨텍스트 충돌을 없앤다.
async function main() {
    const filter = process.argv[2] || "";
    const jobs = pick(filter);
    console.log(`녹화 대상: ${jobs.length}편  ${filter ? "(" + filter + ")" : "(전체)"}`);

    let ok = 0, fail = 0;
    const insSecs = jobs.filter((x) => x.role === "instructor" && !x.sec.signup).map((x) => x.sec);
    const stuSecs = jobs.filter((x) => x.role === "student" && !x.sec.signup).map((x) => x.sec);

    const ri = await recordRole("instructor", "hongmun", insSecs);
    ok += ri.ok; fail += ri.fail;
    const rs = await recordRole("student", "gildong", stuSecs);
    ok += rs.ok; fail += rs.fail;
    for (const j of jobs.filter((x) => x.sec.signup)) (await recordSignup(j.role)) ? ok++ : fail++;

    console.log(`\n완료: 성공 ${ok}편 / 실패 ${fail}편 → public/guide/videos/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
