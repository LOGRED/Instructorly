/**
 * 배포 전 QA 자동 점검 스크립트.
 * 강사(hongmun)·학생(gildong)으로 로그인해 주요 라우트를 순회하며
 * 콘솔 에러·페이지 예외·실패한 네트워크 요청을 수집하고 스크린샷을 저장한다.
 * 사전: 데모 시드(seed-demo-hongmun) 적용 + dev 서버 실행.
 * 실행: node scripts/qa-predeploy.cjs  (기본 localhost:3000, QA_BASE 환경변수로 변경)
 */
const path = require("node:path");
const fs = require("node:fs");
const puppeteer = require(path.join(process.cwd(), "node_modules", "puppeteer"));

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = path.join(process.cwd(), ".omc", "qa-shots");
fs.mkdirSync(OUT, { recursive: true });

const report = []; // { page, url, consoleErrors, pageErrors, failedRequests }

// 잠깐 멈춘다(렌더 안정화).
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// 기대 글자가 나타나고 로딩 골격이 사라질 때까지 기다린다.
async function waitReady(page, waitText) {
    if (waitText) {
        await page
            .waitForFunction(
                (t) => document.body && document.body.innerText.includes(t),
                { timeout: 15000 },
                waitText,
            )
            .catch(() => {});
    }
    await page
        .waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 8000 })
        .catch(() => {});
}

// 페이지에 에러 수집기를 붙인다. 수집 배열들을 반환.
function attachCollectors(page) {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 400));
    });
    page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 400)));
    page.on("requestfailed", (req) => {
        const f = req.failure();
        failedRequests.push(`${req.method()} ${req.url()} — ${f ? f.errorText : "?"}`);
    });
    page.on("response", (res) => {
        if (res.status() >= 400) {
            failedRequests.push(`HTTP ${res.status()} ${res.request().method()} ${res.url()}`);
        }
    });
    return { consoleErrors, pageErrors, failedRequests };
}

// 한 화면을 방문·촬영하고 그 사이 발생한 에러를 리포트에 기록한다.
async function visit(page, collectors, name, url, { waitText, build = false, action } = {}) {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;
    collectors.failedRequests.length = 0;
    try {
        await page.goto(BASE + url, {
            waitUntil: build ? "domcontentloaded" : "networkidle2",
            timeout: 30000,
        });
        await waitReady(page, waitText);
        await sleep(build ? 1800 : 700);
        if (action) {
            await action(page);
            await sleep(1000);
        }
        await page.screenshot({ path: path.join(OUT, name + ".png") });
        console.log("  ✓", name);
    } catch (e) {
        console.log("  ✗", name, "—", e.message);
        collectors.pageErrors.push("NAVIGATION FAIL: " + e.message);
        await page.screenshot({ path: path.join(OUT, name + ".png") }).catch(() => {});
    }
    report.push({
        page: name,
        url,
        consoleErrors: [...collectors.consoleErrors],
        pageErrors: [...collectors.pageErrors],
        failedRequests: [...collectors.failedRequests],
    });
}

// 아이디/비밀번호로 로그인한다(React controlled input이라 실제 키 입력 사용).
async function login(page, id, pw) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
        await page.waitForSelector("#login-id", { timeout: 10000 }).catch(() => {});
        await sleep(300);
        await page.click("#login-id", { clickCount: 3 }).catch(() => {});
        await page.type("#login-id", id, { delay: 15 });
        await page.click("#login-pw", { clickCount: 3 }).catch(() => {});
        await page.type("#login-pw", pw, { delay: 15 });
        await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button:not([role="tab"])')];
            const el = btns.find((b) => b.textContent.trim() === "로그인");
            if (el) el.click();
        });
        const ok = await page
            .waitForFunction(
                () => {
                    try {
                        const r = JSON.parse(localStorage.getItem("maketor-identity") || "{}");
                        return !!(r.state && r.state.role);
                    } catch {
                        return false;
                    }
                },
                { timeout: 8000 },
            )
            .then(() => true)
            .catch(() => false);
        if (ok) return true;
    }
    return false;
}

// 로그아웃(localStorage 비우기).
async function logout(page) {
    await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.clear());
}

// 전체 QA 순회 본체.
(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--window-size=1920,1080"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    page.on("dialog", (d) => d.accept());
    const collectors = attachCollectors(page);

    console.log("== 비로그인 ==");
    await visit(page, collectors, "00-landing", "/", { waitText: "Instructorly" });
    await visit(page, collectors, "01-login", "/login", { waitText: "로그인" });
    await visit(page, collectors, "02-guide", "/guide", {});
    await visit(page, collectors, "03-guide-start", "/guide/start", {});

    console.log("== 강사(hongmun) ==");
    const okI = await login(page, "hongmun", "1234");
    console.log("  로그인:", okI ? "성공" : "실패");
    await visit(page, collectors, "10-programs-instructor", "/programs", {});
    await visit(page, collectors, "11-program-detail", "/programs/hongmun-ai-2026", {
        waitText: "처음 만나는 생성형 AI",
    });
    await visit(page, collectors, "12-studio", "/studio", {});
    await visit(page, collectors, "13-build", "/build/demo-welcome", { build: true });
    await visit(page, collectors, "14-drill-instructor", "/drill/drill-w03", {});
    await visit(page, collectors, "15-atelier-instructor", "/atelier/hm-atelier-w03", {});
    await visit(page, collectors, "16-post", "/posts/post-intro", {});
    await visit(page, collectors, "17-settings", "/settings", {});
    await logout(page);

    console.log("== 학생(gildong) ==");
    const okS = await login(page, "gildong", "1234");
    console.log("  로그인:", okS ? "성공" : "실패");
    await visit(page, collectors, "20-programs-student", "/programs", {});
    await visit(page, collectors, "21-program-student", "/programs/hongmun-ai-2026", {});
    await visit(page, collectors, "22-drill-student", "/drill/drill-w03", {});
    await visit(page, collectors, "23-atelier-student", "/atelier/hm-atelier-w03", {});

    await browser.close();
    fs.writeFileSync(path.join(OUT, "qa-report.json"), JSON.stringify(report, null, 2));
    // 요약 출력
    console.log("\n== 에러 요약 ==");
    let any = false;
    for (const r of report) {
        const n = r.consoleErrors.length + r.pageErrors.length + r.failedRequests.length;
        if (n > 0) {
            any = true;
            console.log(`\n[${r.page}] ${r.url}`);
            r.pageErrors.forEach((e) => console.log("  pageerror:", e));
            r.consoleErrors.forEach((e) => console.log("  console:", e));
            r.failedRequests.forEach((e) => console.log("  network:", e));
        }
    }
    if (!any) console.log("전 페이지 에러 없음 ✓");
})();
