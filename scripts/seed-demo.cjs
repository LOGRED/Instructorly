/**
 * 어르신 AI 교실 12주차 예시 데이터 시드 스크립트(수동 실행용).
 * 강사 1명 + 수강생 10명 + 12주차 강좌(강의·공지·게시물·시험/연습) + 수강신청·진도·
 * 채팅·댓글을 data/maketor.db 에 직접 넣는다. AI(OpenRouter) 호출 없이 사람이 만든
 * 듯한 실제 데이터를 채운다. 같은 id 를 REPLACE 하므로 여러 번 돌려도 안전하다.
 *
 * 실행:  node scripts/seed-demo.cjs
 */
const path = require("node:path");
const Database = require(path.join(process.cwd(), "node_modules", "better-sqlite3"));

const DB_PATH = path.join(process.cwd(), "data", "maketor.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ---------- 시간 헬퍼 ----------
// 강좌 시작(2026-03-03 화) 기준으로 주차별 타임스탬프를 만든다.
const COURSE_START = new Date("2026-03-03T10:00:00+09:00").getTime();
const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// n주차(1-base)의 수업 시각을 반환한다.
function weekTime(n) {
    return COURSE_START + (n - 1) * WEEK;
}

// ---------- 블럭 헬퍼 ----------
// 본문 블럭들을 짧게 만들기 위한 팩토리. id 는 호출부에서 강의별로 유일하게 준다.
function H(id, level, text) {
    return { id, type: "heading", level, text };
}
function T(id, markdown) {
    return { id, type: "text", markdown };
}
function C(id, emoji, text) {
    return { id, type: "callout", emoji, text };
}
function Q(id, text) {
    return { id, type: "quote", text };
}
function DIV(id) {
    return { id, type: "divider" };
}
function IMG(id, prompt, seed) {
    return { id, type: "image", mode: "gen", prompt, imageUrl: null, seed: seed ?? 42, genMs: null };
}
function LLM(id, prompt, output, genMs, locked) {
    return {
        id,
        type: "llm",
        prompt,
        output,
        genMs: genMs ?? null,
        model: "openai/gpt-5.5",
        modelLabel: "GPT-5.5",
        locked: !!locked,
    };
}
function TBL(id, headers, rows) {
    return { id, type: "table", headers, rows };
}

// ---------- 계정 ----------
const INSTRUCTOR = { id: "hjjung", password: "1234", name: "정현주", role: "instructor", avatar: "fox" };
const STUDENTS = [
    { id: "boknam", name: "김복남", avatar: "rabbit" },
    { id: "soonja2", name: "이순자", avatar: "cat" },
    { id: "youngsu", name: "박영수", avatar: "dog" },
    { id: "malsoon", name: "정말순", avatar: "panda" },
    { id: "gapsu", name: "한갑수", avatar: "penguin" },
    { id: "okbun", name: "윤옥분", avatar: "frog" },
    { id: "byungchul", name: "강병철", avatar: "bear" },
    { id: "myungja", name: "서명자", avatar: "fox" },
    { id: "taesik", name: "오태식", avatar: "rabbit" },
    { id: "geumsil", name: "최금실", avatar: "cat" },
];

// 계정을 넣는다(있으면 덮어씀). 비밀번호는 프로토타입용 평문.
function seedUsers() {
    const stmt = db.prepare(
        "INSERT INTO users (id, password, name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(id) DO UPDATE SET password=excluded.password, name=excluded.name, role=excluded.role, avatar=excluded.avatar",
    );
    const base = COURSE_START - 5 * DAY;
    stmt.run(INSTRUCTOR.id, INSTRUCTOR.password, INSTRUCTOR.name, INSTRUCTOR.role, INSTRUCTOR.avatar, base);
    STUDENTS.forEach((s, i) => {
        stmt.run(s.id, "1234", s.name, "student", s.avatar, base + i * HOUR);
    });
    console.log(`  계정: 강사 1 + 수강생 ${STUDENTS.length} 명`);
}

// ---------- 강의(주차별 1개) ----------
const PROGRAM_ID = "ai-senior-2026";

// 12개 강의(course)를 만들어 upsert 하고, 강의 id 배열을 돌려준다.
function buildLessons() {
    const lessons = [];

    // 1주차 ── 오리엔테이션
    lessons.push({
        id: "lsn-w01",
        title: "1주차 · AI가 대체 뭔가요?",
        description: "어렵지 않아요. 오늘은 AI가 무엇인지 천천히 알아봅니다.",
        pages: [
            {
                id: "p1",
                title: "환영합니다",
                blocks: [
                    H("w01-1", 1, "어르신을 위한 AI 친구 만들기"),
                    T("w01-2", "안녕하세요. 12주 동안 함께할 **정현주 강사**입니다. 😊\n\n이 수업은 **스마트폰 하나로 AI와 친구가 되는** 수업이에요. 글씨가 작으면 오른쪽 위 **글자 크기** 버튼을 눌러 크게 키우세요."),
                    C("w01-3", "💡", "오늘은 아무것도 외우지 않아도 됩니다. 그냥 편하게 구경만 하세요."),
                    IMG("w01-4", "햇살 가득한 복지관 교실에서 어르신들이 스마트폰을 보며 환하게 웃는 모습, 따뜻한 수채화풍", 101),
                ],
            },
            {
                id: "p2",
                title: "AI에게 인사해 보기",
                blocks: [
                    H("w01-5", 2, "AI는 똑똑한 비서예요"),
                    T("w01-6", "AI는 우리가 묻는 말에 **대답해 주는 컴퓨터 비서**예요. 아래 칸에 인사를 적고 **실행**을 눌러 보세요."),
                    LLM(
                        "w01-7",
                        "안녕하세요. 저는 일흔두 살이고 AI가 처음입니다. 쉽게 인사해 주세요.",
                        "안녕하세요, 어르신! 만나서 정말 반갑습니다. 😊\n\nAI가 처음이시라니 더욱 환영해요. 어렵게 생각하지 않으셔도 됩니다. 저는 어르신이 궁금한 것을 물어보시면 친구처럼 대답해 드리는 도우미예요.\n\n오늘은 그냥 \"날씨 어때?\", \"좋은 글귀 하나 알려줘\" 처럼 편하게 말 걸어 보세요. 천천히, 재미있게 시작해 봅시다!",
                        2100,
                    ),
                    C("w01-8", "✅", "보셨죠? 말을 걸면 대답이 옵니다. 이게 전부예요. 다음 주에 또 만나요!"),
                ],
            },
        ],
    });

    // 2주차 ── 스마트폰과 친해지기
    lessons.push({
        id: "lsn-w02",
        title: "2주차 · 스마트폰과 친해지기",
        description: "AI를 쓰기 전, 스마트폰 기본기를 다집니다.",
        pages: [
            {
                id: "p1",
                title: "꼭 알아둘 버튼들",
                blocks: [
                    H("w02-1", 1, "스마트폰, 겁내지 마세요"),
                    T("w02-2", "스마트폰에서 자주 쓰는 동작은 딱 세 가지예요. 외우지 말고 손으로 익히면 됩니다."),
                    TBL(
                        "w02-3",
                        ["동작", "방법", "언제 쓰나요"],
                        [
                            ["누르기(탭)", "손가락으로 한 번 콕", "앱 열기, 버튼 누르기"],
                            ["밀기(스크롤)", "위아래로 쓸어올리기", "글을 더 내려 볼 때"],
                            ["키우기", "두 손가락으로 벌리기", "글씨·사진 크게 볼 때"],
                        ],
                    ),
                    C("w02-4", "👆", "지금 이 화면도 손가락 두 개로 벌리면 커집니다. 한번 해 보세요!"),
                ],
            },
            {
                id: "p2",
                title: "음성으로 입력하기",
                blocks: [
                    H("w02-5", 2, "손이 불편하면 말로 하세요"),
                    T("w02-6", "타자가 느려도 괜찮아요. **마이크 버튼**을 누르고 말하면 글자로 바뀝니다. AI에게 말로 부탁해 봅시다."),
                    LLM(
                        "w02-7",
                        "스마트폰 글씨를 더 크게 키우는 방법을 3단계로 아주 쉽게 알려줘.",
                        "네, 어르신! 글씨를 크게 키우는 방법을 알려드릴게요.\n\n1단계: 스마트폰의 **설정**(톱니바퀴 모양)을 누르세요.\n2단계: **화면** 또는 **디스플레이**를 찾아 누르세요.\n3단계: **글자 크기**를 오른쪽으로 밀면 글씨가 커집니다.\n\n다 하셨으면 문자나 카카오톡을 열어 글씨가 커졌는지 확인해 보세요. 한결 보기 편하실 거예요. 😊",
                        1800,
                    ),
                ],
            },
        ],
    });

    // 3주차 ── ChatGPT 처음 만나기
    lessons.push({
        id: "lsn-w03",
        title: "3주차 · ChatGPT 처음 만나기",
        description: "세상에서 가장 유명한 AI, ChatGPT를 직접 써 봅니다.",
        pages: [
            {
                id: "p1",
                title: "ChatGPT가 뭐예요?",
                blocks: [
                    H("w03-1", 1, "ChatGPT — 말이 통하는 AI"),
                    T("w03-2", "ChatGPT는 **사람처럼 대화하는 AI**예요. 모르는 것을 물어보면 친절히 풀어서 설명해 줍니다."),
                    Q("w03-3", "“손주에게 물어보기 미안했던 것들, 이제 AI에게 마음껏 물어보세요.”"),
                    IMG("w03-4", "스마트폰 화면에 말풍선이 오가는 친근한 그림, 파스텔 톤, 단순하고 깔끔한 일러스트", 303),
                ],
            },
            {
                id: "p2",
                title: "직접 물어보기",
                blocks: [
                    H("w03-5", 2, "무엇이든 물어보세요"),
                    LLM(
                        "w03-6",
                        "된장찌개를 더 맛있게 끓이는 비법 세 가지만 알려줘.",
                        "맛있는 된장찌개 비법 세 가지 알려드릴게요! 🍲\n\n1. **육수를 내세요.** 멸치와 다시마를 우린 물로 끓이면 국물이 훨씬 깊어집니다.\n2. **된장은 두 번 나눠 푸세요.** 처음에 반, 마지막에 반을 넣으면 구수한 향이 살아요.\n3. **두부는 마지막에.** 너무 일찍 넣으면 부서지니, 불 끄기 직전에 넣고 한소끔만 끓이세요.\n\n오늘 저녁에 한번 해 보시면 가족들이 좋아하실 거예요. 😋",
                        2300,
                    ),
                    C("w03-7", "📝", "이번 주 숙제: 오늘 저녁 메뉴를 AI에게 추천받아 보세요. 다음 주에 이야기 나눠요!"),
                ],
            },
        ],
    });

    // 4주차 ── 질문 잘하는 법
    lessons.push({
        id: "lsn-w04",
        title: "4주차 · 질문 잘하는 법 (프롬프트)",
        description: "똑같은 AI도 어떻게 묻느냐에 따라 대답이 달라져요.",
        pages: [
            {
                id: "p1",
                title: "좋은 질문의 비밀",
                blocks: [
                    H("w04-1", 1, "구체적으로 물으면 똑똑하게 답해요"),
                    T("w04-2", "AI에게 묻는 말을 **프롬프트**라고 해요. 어렵지 않아요. 그냥 **자세히** 부탁하면 됩니다."),
                    TBL(
                        "w04-3",
                        ["이렇게 말고", "이렇게 하세요"],
                        [
                            ["편지 써줘", "환갑 맞은 친구에게 보낼 따뜻한 축하 편지를 5줄로 써줘"],
                            ["운동 알려줘", "무릎이 안 좋은 70대가 집에서 할 수 있는 가벼운 운동 3가지 알려줘"],
                        ],
                    ),
                    C("w04-4", "🔑", "비법: ‘누가 · 무엇을 · 어떻게(몇 개/몇 줄)’ 를 넣으면 답이 좋아져요."),
                ],
            },
            {
                id: "p2",
                title: "비교해 보기",
                blocks: [
                    H("w04-5", 2, "직접 느껴 보세요"),
                    LLM(
                        "w04-6",
                        "무릎이 안 좋은 70대가 집에서 의자에 앉아 할 수 있는 가벼운 운동 3가지를 안전 주의사항과 함께 알려줘.",
                        "무릎에 무리 없는 의자 운동 3가지를 알려드릴게요. 천천히 하시는 게 가장 중요해요!\n\n1. **발목 돌리기** — 의자에 앉아 한쪽 발을 살짝 들고 발목을 동그랗게 10번. 반대쪽도요.\n2. **다리 펴 들기** — 앉은 채 한쪽 다리를 천천히 앞으로 쭉 펴서 3초 멈췄다 내리기, 10번.\n3. **앉았다 일어서기** — 식탁을 잡고 의자에서 천천히 일어섰다 앉기 5번.\n\n⚠️ 주의: 통증이 느껴지면 즉시 멈추세요. 숨을 참지 말고 자연스럽게 쉬면서 하세요. 무리는 금물입니다!",
                        2600,
                    ),
                ],
            },
        ],
    });

    // 5주차 ── AI에게 글 부탁하기
    lessons.push({
        id: "lsn-w05",
        title: "5주차 · AI에게 글 부탁하기",
        description: "편지, 문자, 축하 메시지를 AI와 함께 써 봅니다.",
        pages: [
            {
                id: "p1",
                title: "마음을 글로",
                blocks: [
                    H("w05-1", 1, "쓰기 어려운 글, AI가 도와줘요"),
                    T("w05-2", "손주 생일 축하, 친구 문병 인사… 막상 쓰려면 막막하죠. AI에게 부탁하면 **밑글**을 만들어 줍니다. 거기에 내 마음만 더하면 돼요."),
                    LLM(
                        "w05-3",
                        "초등학교 들어가는 손녀에게 보낼 따뜻한 축하 문자를 4줄로 써줘.",
                        "우리 예쁜 손녀, 드디어 초등학생이 되는구나! 🎒\n할머니는 우리 손녀가 정말 자랑스럽단다.\n새 친구들과 사이좋게 지내고, 선생님 말씀 잘 듣고 오렴.\n할머니가 늘 응원할게. 사랑한다. ❤️",
                        1900,
                    ),
                    C("w05-4", "✍️", "AI가 써 준 글을 그대로 쓰지 말고, 손녀 이름을 넣어 ‘내 글’로 바꿔 보세요."),
                ],
            },
            {
                id: "p2",
                title: "고쳐 쓰기도 부탁해요",
                blocks: [
                    H("w05-5", 2, "더 짧게, 더 정중하게"),
                    T("w05-6", "이미 쓴 글도 \"더 짧게 해줘\", \"더 정중하게 바꿔줘\" 하면 AI가 다듬어 줍니다."),
                    LLM(
                        "w05-7",
                        "아래 문자를 더 정중하게 바꿔줘: 모임 이번주 토요일로 바꿉시다 다들 시간 비워두세요",
                        "안녕하세요, 여러분. 😊\n\n이번 정기 모임을 **이번 주 토요일**로 변경하고자 합니다. 바쁘시겠지만 그날 시간을 비워 두시면 감사하겠습니다.\n\n자세한 장소와 시간은 다시 안내드리겠습니다. 모두 건강하시고, 그날 반갑게 뵙겠습니다!",
                        2000,
                    ),
                ],
            },
        ],
    });

    // 6주차 ── AI로 그림 그리기
    lessons.push({
        id: "lsn-w06",
        title: "6주차 · AI로 그림 그리기",
        description: "말로 설명하면 AI가 그림을 그려 줍니다.",
        pages: [
            {
                id: "p1",
                title: "그림도 말로",
                blocks: [
                    H("w06-1", 1, "상상한 그림을 말로 그려요"),
                    T("w06-2", "그리고 싶은 장면을 **글로 설명**하면 AI가 그림으로 만들어 줍니다. 손주 사진 같은 건 못 만들지만, 멋진 풍경이나 카드 그림은 척척이에요."),
                    IMG("w06-3", "벚꽃이 흩날리는 시골 마을 길, 따뜻한 봄날, 평화로운 한국 수채화 풍경", 606),
                    C("w06-4", "🎨", "‘무엇을 + 어떤 분위기로 + 무슨 색으로’ 를 적으면 더 예쁘게 나와요."),
                ],
            },
            {
                id: "p2",
                title: "내 카드 그림 만들기",
                blocks: [
                    H("w06-5", 2, "직접 그려 보세요"),
                    T("w06-6", "아래 칸의 설명을 내가 원하는 대로 바꾼 뒤 **실행**을 눌러 보세요."),
                    IMG("w06-7", "생신 축하 카드용 그림, 환하게 핀 노란 해바라기와 케이크, 밝고 정겨운 분위기", 607),
                    Q("w06-8", "“그림 그릴 줄 몰라도, 마음속 풍경을 그릴 수 있게 됐어요.” — 어느 수강생 후기"),
                ],
            },
        ],
    });

    // 7주차 ── 건강·생활 정보
    lessons.push({
        id: "lsn-w07",
        title: "7주차 · 건강·생활 정보 물어보기",
        description: "AI를 생활 도우미로. 단, 병원은 꼭 따로 가세요!",
        pages: [
            {
                id: "p1",
                title: "생활 속 질문들",
                blocks: [
                    H("w07-1", 1, "궁금한 건 바로바로"),
                    T("w07-2", "약 먹는 시간, 제철 음식, 절약 방법… 사소한 궁금증을 AI에게 물어보세요."),
                    LLM(
                        "w07-3",
                        "혈압약을 아침에 먹는 게 좋은지 저녁에 먹는 게 좋은지 일반적인 정보를 알려줘.",
                        "혈압약 복용 시간은 사람마다, 약 종류마다 다를 수 있어요.\n\n일반적으로는 **아침에 한 번** 드시는 경우가 많지만, 어떤 분들은 의사 선생님 권유로 저녁에 드시기도 합니다.\n\n⚠️ 가장 중요한 점: 복용 시간은 **반드시 처방해 주신 의사·약사와 상의**해서 정하세요. 임의로 시간을 바꾸시면 안 됩니다. AI는 참고용이고, 약은 전문가 안내가 우선이에요!",
                        2400,
                    ),
                    C("w07-5", "⚠️", "건강 정보는 ‘참고’만! 몸이 아프면 AI 말고 꼭 병원에 가세요."),
                ],
            },
            {
                id: "p2",
                title: "제철 살림 정보",
                blocks: [
                    H("w07-6", 2, "장 볼 때도 똑똑하게"),
                    LLM(
                        "w07-7",
                        "3월에 싸고 맛있는 제철 채소와 간단한 요리법을 알려줘.",
                        "3월 제철 채소 알려드릴게요! 🌱\n\n- **냉이**: 향긋한 봄나물. 된장국에 넣으면 향이 끝내줍니다.\n- **달래**: 양념장에 넣어 비비면 입맛이 확 살아나요.\n- **봄동**: 겉절이로 무치면 아삭달콤합니다.\n\n간단 요리: 봄동을 한입 크기로 썰어 고춧가루·멸치액젓·다진마늘·참기름에 살살 무치면 끝! 밥 한 그릇 뚝딱이에요. 😋",
                        2200,
                    ),
                ],
            },
        ],
    });

    // 8주차 ── 멀티모달
    lessons.push({
        id: "lsn-w08",
        title: "8주차 · 사진과 음성으로 대화하기",
        description: "글자뿐 아니라 사진을 보여주고, 목소리로 묻습니다.",
        pages: [
            {
                id: "p1",
                title: "사진을 보여주세요",
                blocks: [
                    H("w08-1", 1, "AI는 사진도 알아봐요"),
                    T("w08-2", "약봉투 사진을 보여주며 \"이 약 언제 먹어?\", 꽃 사진을 보여주며 \"이 꽃 이름 뭐야?\" 하고 물을 수 있어요."),
                    IMG("w08-3", "스마트폰으로 들꽃을 찍는 노인의 손, 화면에 꽃 이름이 떠 있는 모습, 따뜻한 사진풍", 808),
                    C("w08-4", "📷", "카메라 버튼을 누르고 찍은 뒤, ‘이게 뭐야?’ 라고 물어보면 됩니다."),
                ],
            },
            {
                id: "p2",
                title: "목소리로 대화",
                blocks: [
                    H("w08-5", 2, "말로 묻고 귀로 들어요"),
                    T("w08-6", "눈이 침침하고 타자가 힘들면 **음성**이 최고예요. 마이크를 켜고 말하면 AI가 듣고, 읽어 주기도 합니다."),
                    LLM(
                        "w08-7",
                        "오늘 날씨에 맞춰 산책할 때 옷차림을 어떻게 하면 좋을지 알려줘.",
                        "산책 나가시려고요? 좋은 생각이에요! 🚶\n\n환절기에는 **얇은 옷을 여러 겹** 입는 게 좋아요. 더우면 하나 벗고, 추우면 다시 입을 수 있으니까요.\n\n- 안에: 얇은 긴팔 한 장\n- 겉에: 바람막이나 가디건\n- 모자와 편한 운동화도 잊지 마세요!\n\n아침저녁은 아직 쌀쌀하니 무리하지 마시고, 햇볕 좋은 낮에 다녀오시길 권해요. 😊",
                        2100,
                    ),
                ],
            },
        ],
    });

    // 9주차 ── 가족과 나누기
    lessons.push({
        id: "lsn-w09",
        title: "9주차 · 가족과 나누기",
        description: "만든 글과 그림을 가족과 카카오톡으로 나눠요.",
        pages: [
            {
                id: "p1",
                title: "명절 카드 만들기",
                blocks: [
                    H("w09-1", 1, "마음을 담아 가족에게"),
                    T("w09-2", "AI로 만든 그림에, AI가 도와준 인사글을 더하면 멋진 **디지털 카드**가 됩니다. 자녀·손주에게 보내 보세요."),
                    IMG("w09-3", "가족에게 보낼 안부 카드 그림, 따뜻한 노을과 손편지 느낌, 정겨운 색감", 909),
                    LLM(
                        "w09-4",
                        "객지에 사는 아들 가족에게 보낼 짧고 따뜻한 안부 인사를 3줄로 써줘.",
                        "아들아, 며늘아, 잘 지내지? 🌷\n멀리 있어도 늘 너희 생각뿐이란다. 끼니 거르지 말고 건강 잘 챙기렴.\n바쁘면 전화 한 통이면 충분해. 보고 싶다, 우리 가족. ❤️",
                        1800,
                    ),
                ],
            },
            {
                id: "p2",
                title: "보내는 법",
                blocks: [
                    H("w09-5", 2, "카카오톡으로 전송"),
                    T("w09-6", "만든 그림을 **꾹 눌러 저장**한 뒤, 카카오톡 대화창에서 **사진 보내기**로 고르면 끝이에요. 글은 복사해서 붙여 넣으면 됩니다."),
                    C("w09-7", "💝", "이번 주 미션: 가족 한 명에게 AI 카드를 보내고, 답장을 받아 오세요!"),
                ],
            },
        ],
    });

    // 10주차 ── 정보 구별하기(환각)
    lessons.push({
        id: "lsn-w10",
        title: "10주차 · AI를 믿어도 될까요?",
        description: "AI도 가끔 틀려요. 똑똑하게 걸러 듣는 법.",
        pages: [
            {
                id: "p1",
                title: "AI도 거짓말을 해요",
                blocks: [
                    H("w10-1", 1, "AI는 ‘아는 척’ 할 때가 있어요"),
                    T("w10-2", "AI는 똑똑하지만 가끔 **그럴듯하게 틀린 말**을 해요. 이걸 ‘환각’이라고 부릅니다. 특히 **숫자·날짜·법·돈** 이야기는 꼭 한 번 더 확인하세요."),
                    C("w10-3", "🚨", "특히 조심: 송금 요청, 비밀번호, ‘당첨됐다’는 말은 AI든 문자든 무조건 의심하세요!"),
                    TBL(
                        "w10-4",
                        ["믿어도 되는 것", "꼭 확인할 것"],
                        [
                            ["요리법, 글쓰기 도움", "병원·약 정보"],
                            ["일반 상식, 아이디어", "법률·세금·연금 액수"],
                            ["번역, 말동무", "최신 뉴스·날짜·통계"],
                        ],
                    ),
                ],
            },
            {
                id: "p2",
                title: "확인하는 습관",
                blocks: [
                    H("w10-5", 2, "‘출처’를 물어보세요"),
                    T("w10-6", "중요한 답을 들으면 \"확실해? 어디서 나온 정보야?\" 라고 되물어 보세요. AI가 확신이 없으면 솔직히 말해 줍니다."),
                    LLM(
                        "w10-7",
                        "노인 무료 지하철 나이 기준을 알려줘. 그리고 이 정보가 확실한지, 어디서 확인해야 하는지도 알려줘.",
                        "우리나라는 보통 **만 65세 이상**이면 지하철을 무료로 이용하실 수 있어요(경로우대).\n\n다만 ⚠️ 제도는 지역과 시기에 따라 바뀔 수 있고, 최근에는 기준 연령 조정 논의도 있었어요. 그래서 제 답만 믿지 마시고 **반드시 확인**하시길 권해요:\n\n- 가까운 **주민센터**에 문의\n- **국민신문고**나 해당 지하철공사 누리집 확인\n\n저는 참고용 도우미일 뿐이니, 정확한 최신 기준은 공식 기관에서 꼭 확인하세요! 😊",
                        2700,
                    ),
                ],
            },
        ],
    });

    // 11주차 ── 나만의 활용
    lessons.push({
        id: "lsn-w11",
        title: "11주차 · 나만의 AI 활용법",
        description: "취미·여행·일상에 AI를 내 것으로 써 봅니다.",
        pages: [
            {
                id: "p1",
                title: "취미 짝꿍 AI",
                blocks: [
                    H("w11-1", 1, "AI는 평생 친구가 돼요"),
                    T("w11-2", "화초 키우기, 바둑, 트로트 가사, 여행 계획… 무엇이든 AI와 함께하면 더 즐거워요."),
                    LLM(
                        "w11-3",
                        "초보자가 키우기 쉬운 실내 화분 3가지와 물 주는 방법을 알려줘.",
                        "초보자도 잘 키우는 효자 화분 3가지예요! 🪴\n\n1. **스킨답서스** — 그늘에서도 잘 자라요. 흙이 마르면 물 주기(주 1회 정도).\n2. **산세베리아** — 물을 자주 안 줘도 돼요. 2주에 한 번이면 충분! 공기 정화에도 좋아요.\n3. **다육이** — 햇볕 좋아하고 물은 아주 가끔(2~3주에 한 번). 통통한 모습이 귀엽죠.\n\n공통 비법: 손가락으로 흙을 눌러 **마른 느낌이면 물 주기**. 너무 자주 주면 뿌리가 썩으니 주의하세요!",
                        2400,
                    ),
                ],
            },
            {
                id: "p2",
                title: "여행 계획 세우기",
                blocks: [
                    H("w11-5", 2, "당일치기도 척척"),
                    LLM(
                        "w11-6",
                        "70대 부부가 무리하지 않고 다녀올 수 있는 봄 당일치기 여행지를 이유와 함께 2곳 추천해줘.",
                        "무리 없이 다녀오기 좋은 봄 당일치기 여행지 2곳 추천드려요! 🌸\n\n1. **경기 양평 두물머리** — 평지라 걷기 편하고, 강가 풍경이 아름다워요. 연잎밥 같은 건강식당도 많아 식사도 편안합니다.\n2. **충남 아산 외암마을** — 한옥과 돌담길이 정겨운 민속마을이에요. 천천히 둘러보기 좋고, 근처 온천에서 피로도 풀 수 있어요.\n\n두 곳 다 차로 다녀오기 좋고 길이 험하지 않아요. 봄볕 좋은 평일에 다녀오시면 사람도 적어 더 여유롭답니다. 😊",
                        2800,
                    ),
                    C("w11-7", "🧳", "다음 주는 마지막! 그동안 만든 작품 하나를 골라 발표 준비를 해 오세요."),
                ],
            },
        ],
    });

    // 12주차 ── 발표회 & 수료
    lessons.push({
        id: "lsn-w12",
        title: "12주차 · 발표회와 수료식",
        description: "12주간의 여정을 마무리하고 수료증을 받습니다.",
        pages: [
            {
                id: "p1",
                title: "우리가 해낸 것들",
                blocks: [
                    H("w12-1", 1, "축하합니다! 🎉"),
                    T("w12-2", "12주 전, 스마트폰도 어렵던 우리가 이제 **AI와 대화하고, 글을 쓰고, 그림까지** 만들게 됐어요. 정말 대단하십니다."),
                    TBL(
                        "w12-3",
                        ["배운 것", "이제 할 수 있어요"],
                        [
                            ["AI에게 묻기", "궁금한 걸 바로바로 물어봐요"],
                            ["글 부탁하기", "편지·문자를 척척 써요"],
                            ["그림 만들기", "카드와 그림을 직접 만들어요"],
                            ["똑똑하게 걸러 듣기", "거짓 정보를 의심할 줄 알아요"],
                        ],
                    ),
                    IMG("w12-4", "복지관 수료식, 어르신들이 수료증을 들고 환하게 웃는 단체 사진, 꽃과 현수막, 따뜻한 분위기", 1212),
                ],
            },
            {
                id: "p2",
                title: "마지막 한마디",
                blocks: [
                    H("w12-5", 2, "끝이 아니라 시작이에요"),
                    Q("w12-6", "“나이는 숫자일 뿐, 배움에는 끝이 없다.”"),
                    LLM(
                        "w12-7",
                        "12주 AI 교실을 수료한 어르신들에게 강사가 전할 따뜻한 축하 인사말을 5줄로 써줘.",
                        "어르신 여러분, 12주 동안 정말 고생 많으셨습니다. 👏\n처음의 그 막막함을 이겨내고 여기까지 오신 여러분이 진심으로 자랑스럽습니다.\n이제 AI는 어려운 기계가 아니라, 든든한 말동무이자 도우미가 되었지요.\n오늘 배움을 멈추지 마시고, 손주에게도 자랑스럽게 알려 주세요.\n늘 건강하시고, 또 다른 배움의 자리에서 반갑게 뵙겠습니다. 사랑합니다! ❤️",
                        2500,
                    ),
                    C("w12-8", "🎓", "수료를 진심으로 축하드립니다. 그동안 함께해 주셔서 고맙습니다 — 정현주 드림"),
                ],
            },
        ],
    });

    // upsert
    const stmt = db.prepare(
        `INSERT INTO courses (id, title, description, cover, author_nickname, data, created_at, updated_at)
         VALUES (@id, @title, @description, NULL, @author, @data, @created, @updated)
         ON CONFLICT(id) DO UPDATE SET title=@title, description=@description,
           author_nickname=@author, data=@data, updated_at=@updated`,
    );
    lessons.forEach((l, i) => {
        const t = weekTime(i + 1) - 2 * DAY; // 강의는 수업 이틀 전 준비
        stmt.run({
            id: l.id,
            title: l.title,
            description: l.description,
            author: INSTRUCTOR.name,
            data: JSON.stringify({ pages: l.pages, maxWidth: "4xl" }),
            created: t,
            updated: t,
        });
    });
    console.log(`  강의: ${lessons.length}개 주차`);
    return lessons.map((l) => l.id);
}

// ---------- 공지사항 ----------
// 강좌 공지 몇 건을 만든다.
function seedAnnouncements() {
    const items = [
        {
            id: "ann-open",
            week: 1,
            title: "[개강 안내] AI 교실 12주 과정을 시작합니다",
            blocks: [
                H("ao-1", 2, "환영합니다, 어르신 여러분!"),
                T("ao-2", "오늘부터 매주 **화요일 오전 10시**, 총 12주 동안 함께합니다. 준비물은 **충전된 스마트폰** 하나면 충분해요.\n\n글씨가 작으면 화면 오른쪽 위 글자 크기 버튼을 눌러 키우세요. 모르는 건 언제든 손 들어 주세요!"),
                C("ao-3", "📞", "결석하시거나 도움이 필요하면 복지관(02-000-0000)으로 연락 주세요."),
            ],
        },
        {
            id: "ann-mid",
            week: 6,
            title: "[중간 안내] 절반을 지났어요 — 작품 자랑방을 열었습니다",
            blocks: [
                H("am-1", 2, "벌써 6주차, 정말 잘하고 계세요 👏"),
                T("am-2", "그동안 만든 글과 그림을 **‘작품 자랑방’ 게시판**에 올려 서로 구경해 봐요. 댓글로 칭찬도 나눠 주세요!"),
                C("am-3", "🎨", "이번 주는 AI 그림 그리기! 만든 그림을 꼭 자랑방에 올려 주세요."),
            ],
        },
        {
            id: "ann-grad",
            week: 12,
            title: "[수료식 안내] 12주차 발표회와 수료증 수여",
            blocks: [
                H("ag-1", 2, "드디어 수료식입니다 🎓"),
                T("ag-2", "마지막 주차에는 **각자 만든 작품 발표**와 **수료증 수여식**이 있습니다. 그동안 만든 작품 중 가장 마음에 드는 하나를 골라 와 주세요.\n\n간단한 다과도 준비되어 있습니다. 가족과 함께 오셔도 좋아요!"),
                Q("ag-3", "“끝까지 함께해 주신 여러분 모두가 주인공입니다.”"),
            ],
        },
    ];
    const stmt = db.prepare(
        `INSERT INTO announcements (id, program_id, title, author_id, author_name, data, created_at, updated_at)
         VALUES (@id, @pid, @title, @aid, @aname, @data, @t, @t)
         ON CONFLICT(id) DO UPDATE SET title=@title, data=@data, updated_at=@t`,
    );
    for (const a of items) {
        const t = weekTime(a.week) - 1 * DAY;
        stmt.run({
            id: a.id,
            pid: PROGRAM_ID,
            title: a.title,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            data: JSON.stringify({ blocks: a.blocks }),
            t,
        });
    }
    console.log(`  공지: ${items.length}건`);
    return items;
}

// ---------- 게시물 + 댓글 ----------
// 자기소개·작품자랑 게시물과 학생 댓글(비밀댓글 포함)을 만든다.
function seedPosts() {
    const posts = [
        {
            id: "post-intro",
            week: 1,
            title: "[자기소개] 돌아가며 인사 나눠요 🙋",
            blocks: [
                H("pi-1", 2, "서로 인사하는 시간"),
                T("pi-2", "댓글로 **성함**과 **이번 수업에서 배우고 싶은 것**을 적어 주세요. 천천히 한 줄이면 충분해요!"),
            ],
            comments: [
                { who: "boknam", text: "김복남입니다. 손주랑 카톡으로 사진 주고받는 게 소원이에요. 잘 부탁드려요!", off: 2 * HOUR },
                { who: "youngsu", text: "박영수요. 아내한테 AI로 멋진 편지 한번 써주고 싶습니다 허허.", off: 5 * HOUR },
                { who: "okbun", text: "윤옥분이에요. 글씨가 안 보여서 걱정인데 천천히 따라가 볼게요.", off: 1 * DAY },
                { who: "malsoon", text: "정말순입니다~ 화초 키우는 거 좋아하는데 AI한테 물어볼 수 있다니 신기하네요.", off: 1 * DAY + 3 * HOUR },
            ],
        },
        {
            id: "post-gallery",
            week: 6,
            title: "[작품 자랑방] 내가 만든 AI 그림을 올려요 🎨",
            blocks: [
                H("pg-1", 2, "오늘 만든 그림 자랑"),
                T("pg-2", "6주차에 만든 AI 그림을 댓글로 자랑해 주세요. 서로 칭찬 댓글도 잊지 마세요!"),
                C("pg-3", "💬", "비밀댓글로 강사에게만 질문할 수도 있어요."),
            ],
            comments: [
                { who: "malsoon", text: "해바라기 그림 만들었어요! 생신 카드로 쓰려고요. 너무 예쁘게 나와서 깜짝 놀랐네요 ㅎㅎ", off: 3 * HOUR },
                { who: "geumsil", text: "와 정말순님 그림 너무 곱네요~ 저는 봄 벚꽃길 그렸어요. 손녀가 좋아하더라고요!", off: 5 * HOUR },
                { who: "byungchul", text: "강병철입니다. 바다 그림 그려봤는데 색이 안 마음에 들어요. 어떻게 바꾸나요?", off: 6 * HOUR },
                { who: "gapsu", text: "그림이 자꾸 이상하게 나오는데 비밀로 강사님께 여쭤봅니다…", off: 1 * DAY, secret: true },
            ],
        },
    ];
    const pstmt = db.prepare(
        `INSERT INTO posts (id, program_id, title, author_id, author_name, data, created_at, updated_at)
         VALUES (@id, @pid, @title, @aid, @aname, @data, @t, @t)
         ON CONFLICT(id) DO UPDATE SET title=@title, data=@data, updated_at=@t`,
    );
    const cstmt = db.prepare(
        `INSERT INTO post_comments (id, post_id, parent_id, user_id, author_name, author_avatar, role, text, secret, created_at)
         VALUES (@id, @post, '', @uid, @name, @av, 'student', @text, @secret, @t)`,
    );
    // 재실행 시 댓글 중복 방지: 해당 게시물 댓글 비우고 다시 채움.
    const clearC = db.prepare("DELETE FROM post_comments WHERE post_id = ?");
    const sById = Object.fromEntries(STUDENTS.map((s) => [s.id, s]));
    let cCount = 0;
    for (const p of posts) {
        const base = weekTime(p.week);
        pstmt.run({
            id: p.id,
            pid: PROGRAM_ID,
            title: p.title,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            data: JSON.stringify({ blocks: p.blocks }),
            t: base - 1 * HOUR,
        });
        clearC.run(p.id);
        let n = 0;
        for (const c of p.comments) {
            const s = sById[c.who];
            cstmt.run({
                id: `${p.id}-c${++n}`,
                post: p.id,
                uid: s.id,
                name: s.name,
                av: s.avatar,
                text: c.text,
                secret: c.secret ? 1 : 0,
                t: base + c.off,
            });
            cCount++;
        }
    }
    console.log(`  게시물: ${posts.length}개, 댓글: ${cCount}건`);
    return posts;
}

// ---------- 드릴(시험·연습) ----------
// 실제 LLM 화면을 따라 하는 시험/연습 항목을 만든다.
function seedDrills() {
    const drills = [
        {
            id: "drill-w03",
            week: 3,
            kind: "practice",
            provider: "chatgpt",
            title: "ChatGPT에 말 걸어 보기 (자유 연습)",
            mission: "",
        },
        {
            id: "drill-w04",
            week: 4,
            kind: "exam",
            provider: "chatgpt",
            title: "[미션] 좋은 질문 만들기 시험",
            mission: "‘누가·무엇을·어떻게’가 모두 들어간 질문을 하나 만들어 AI에게 물어보세요. 예: ‘무릎 안 좋은 70대가 집에서 할 수 있는 운동 3가지를 알려줘’. 받은 답을 보고 제출하면 됩니다.",
        },
        {
            id: "drill-w11",
            week: 11,
            kind: "practice",
            provider: "gemini",
            title: "제미나이로 여행 계획 짜 보기 (자유 연습)",
            mission: "",
        },
    ];
    const stmt = db.prepare(
        `INSERT INTO drills (id, program_id, kind, provider, title, mission, author_id, author_name, created_at, updated_at)
         VALUES (@id, @pid, @kind, @provider, @title, @mission, @aid, @aname, @t, @t)
         ON CONFLICT(id) DO UPDATE SET kind=@kind, provider=@provider, title=@title, mission=@mission, updated_at=@t`,
    );
    for (const d of drills) {
        const t = weekTime(d.week) - 1 * DAY;
        stmt.run({
            id: d.id,
            pid: PROGRAM_ID,
            kind: d.kind,
            provider: d.provider,
            title: d.title,
            mission: d.mission,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            t,
        });
    }
    console.log(`  드릴(시험/연습): ${drills.length}건`);
    return drills;
}

// ---------- 프로그램(강좌) ----------
// 12주차 주차 구성을 만들어 프로그램을 upsert 한다.
function seedProgram(lessonIds, anns, posts, drills) {
    // 주차별 항목 구성: 모든 주차에 강의 1개, 일부 주차에 공지/게시물/드릴 추가.
    const extraByWeek = {
        1: [
            { type: "announcement", id: "ann-open" },
            { type: "post", id: "post-intro" },
        ],
        3: [{ type: "practice", id: "drill-w03" }],
        4: [{ type: "exam", id: "drill-w04" }],
        6: [
            { type: "announcement", id: "ann-mid" },
            { type: "post", id: "post-gallery" },
        ],
        11: [{ type: "practice", id: "drill-w11" }],
        12: [{ type: "announcement", id: "ann-grad" }],
    };
    const titles = [
        "AI가 대체 뭔가요?",
        "스마트폰과 친해지기",
        "ChatGPT 처음 만나기",
        "질문 잘하는 법",
        "AI에게 글 부탁하기",
        "AI로 그림 그리기",
        "건강·생활 정보 물어보기",
        "사진과 음성으로 대화하기",
        "가족과 나누기",
        "AI를 믿어도 될까요?",
        "나만의 AI 활용법",
        "발표회와 수료식",
    ];
    const weeks = lessonIds.map((lid, i) => {
        const n = i + 1;
        const items = [{ type: "lesson", id: lid }, ...(extraByWeek[n] ?? [])];
        return {
            id: `wk${n}`,
            weekNo: n,
            title: `${n}주차 — ${titles[i]}`,
            items,
            lessonIds: [lid],
        };
    });
    const now = Date.now();
    const data = JSON.stringify({
        weeks,
        startDate: "2026-03-03",
        endDate: "2026-05-19",
        weekDays: [2], // 화요일
    });
    db.prepare(
        `INSERT INTO programs (id, title, description, cover, owner_id, owner_name, invite_code, data, created_at, updated_at)
         VALUES (@id, @title, @desc, NULL, @oid, @oname, @code, @data, @created, @updated)
         ON CONFLICT(id) DO UPDATE SET title=@title, description=@desc, owner_id=@oid,
           owner_name=@oname, invite_code=@code, data=@data, updated_at=@updated`,
    ).run({
        id: PROGRAM_ID,
        title: "어르신을 위한 AI 친구 만들기 — 12주 완성",
        desc: "스마트폰 하나로 AI와 친구가 되는 12주 과정. 매주 화요일, 천천히 함께 배웁니다.",
        oid: INSTRUCTOR.id,
        oname: INSTRUCTOR.name,
        code: "AI2026",
        data,
        created: COURSE_START - 7 * DAY,
        updated: now,
    });
    console.log("  프로그램: 어르신을 위한 AI 친구 만들기 (12주차) / 초대코드 AI2026");
}

// ---------- 수강신청 ----------
// 모든 학생을 프로그램에 등록한다.
function seedEnrollments() {
    const stmt = db.prepare(
        "INSERT OR IGNORE INTO enrollments (program_id, user_id, name, enrolled_at) VALUES (?, ?, ?, ?)",
    );
    const base = COURSE_START - 3 * DAY;
    STUDENTS.forEach((s, i) => stmt.run(PROGRAM_ID, s.id, s.name, base + i * 30 * 60 * 1000));
    console.log(`  수강신청: ${STUDENTS.length}명`);
}

// ---------- 진도 ----------
// 학생별로 실제처럼 들쭉날쭉한 진도(완료/진행중)를 기록한다.
function seedProgress(lessonIds) {
    const stmt = db.prepare(
        `INSERT INTO lesson_progress (user_id, lesson_id, program_id, max_page, total_pages, completed, updated_at)
         VALUES (@uid, @lid, @pid, @max, @total, @done, @t)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET max_page=@max, total_pages=@total, completed=@done, updated_at=@t`,
    );
    // 학생마다 "끝까지 들은 주차 수"를 다르게 — 성실도 차이를 표현.
    const reach = {
        boknam: 9,
        soonja2: 7,
        youngsu: 12,
        malsoon: 11,
        gapsu: 5,
        okbun: 6,
        byungchul: 8,
        myungja: 10,
        taesik: 4,
        geumsil: 12,
    };
    let rows = 0;
    for (const s of STUDENTS) {
        const upto = reach[s.id] ?? 6;
        for (let w = 1; w <= upto; w++) {
            const lid = lessonIds[w - 1];
            const total = 2; // 각 강의는 2페이지
            const last = w === upto; // 마지막 도달 주차는 진행중(1페이지)
            const maxPage = last && Math.random() < 0.5 ? 0 : total - 1;
            const done = maxPage >= total - 1 ? 1 : 0;
            stmt.run({
                uid: s.id,
                lid,
                pid: PROGRAM_ID,
                max: maxPage,
                total,
                done,
                t: weekTime(w) + 2 * HOUR,
            });
            rows++;
        }
    }
    console.log(`  진도 기록: ${rows}건`);
}

// ---------- 강의 채팅 ----------
// 1주차 강의방에 오가는 대화를 몇 줄 넣어 살아있는 느낌을 준다.
function seedChat() {
    const lid = "lsn-w01";
    db.prepare("DELETE FROM chat_messages WHERE course_id = ?").run(lid);
    const stmt = db.prepare(
        `INSERT INTO chat_messages (id, course_id, user_id, nickname, role, avatar, text, attachments, created_at)
         VALUES (@id, @cid, @uid, @nick, @role, @av, @text, '[]', @t)`,
    );
    const base = weekTime(1) + 10 * 60 * 1000;
    const msgs = [
        { uid: "hjjung", nick: "정현주", role: "instructor", av: "fox", text: "여러분 반갑습니다! 첫 시간이니 편하게 따라오세요. 😊" },
        { uid: "boknam", nick: "김복남", role: "student", av: "rabbit", text: "선생님 글씨가 너무 작아요 ㅠㅠ" },
        { uid: "hjjung", nick: "정현주", role: "instructor", av: "fox", text: "복남 어르신, 오른쪽 위 ‘글자 크기’ 버튼을 눌러 보세요. 두 번 누르면 큼직해집니다!" },
        { uid: "boknam", nick: "김복남", role: "student", av: "rabbit", text: "오 됐어요! 잘 보이네요 고맙습니다~" },
        { uid: "malsoon", nick: "정말순", role: "student", av: "panda", text: "재밌네요 ㅎㅎ AI한테 인사하니까 답이 와요!" },
    ];
    msgs.forEach((m, i) =>
        stmt.run({ id: `chat-w01-${i + 1}`, cid: lid, uid: m.uid, nick: m.nick, role: m.role, av: m.av, text: m.text, t: base + i * 4 * 60 * 1000 }),
    );
    console.log(`  강의 채팅: ${msgs.length}건 (1주차)`);
}

// ---------- 실행 ----------
const run = db.transaction(() => {
    console.log("어르신 AI 교실 12주차 데이터 시드 시작…");
    seedUsers();
    const lessonIds = buildLessons();
    const anns = seedAnnouncements();
    const posts = seedPosts();
    const drills = seedDrills();
    seedProgram(lessonIds, anns, posts, drills);
    seedEnrollments();
    seedProgress(lessonIds);
    seedChat();
});
run();
console.log("완료! 강사 로그인: hjjung / 1234, 학생 로그인: 각 아이디 / 1234, 초대코드: AI2026");
db.close();
