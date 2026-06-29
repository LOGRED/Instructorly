// Server-only SQLite data layer for Instructorly.
// The lecture document (pages + blocks) is persisted wholesale as JSON, which
// keeps the API trivial: load -> edit in memory -> save the whole course back.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
    Block,
    Course,
    CourseSummary,
    ChatMessage,
    Page,
    Role,
    User,
    UserPublic,
    Program,
    ProgramSummary,
    Week,
    WeekItem,
    Enrollment,
    LessonProgress,
    BlockRun,
    StudentBlockWork,
    Post,
    PostSummary,
    Announcement,
    AnnouncementSummary,
    PostComment,
    ChatAttachment,
    Drill,
    DrillSummary,
    DrillKind,
    LlmProvider,
} from "./types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "maketor.db");

declare global {
    // eslint-disable-next-line no-var
    var __maketorDb: Database.Database | undefined;
}

function createDb(): Database.Database {
    fs.mkdirSync(DB_DIR, { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover TEXT,
      author_nickname TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{"pages":[]}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      attachments TEXT NOT NULL DEFAULT '[]',
      reactions TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_course ON chat_messages(course_id, created_at);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'student',
      avatar TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover TEXT,
      owner_id TEXT NOT NULL DEFAULT '',
      owner_name TEXT NOT NULL DEFAULT '',
      invite_code TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{"weeks":[]}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      program_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      enrolled_at INTEGER NOT NULL,
      PRIMARY KEY (program_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_enroll_user ON enrollments(user_id);
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      program_id TEXT NOT NULL DEFAULT '',
      max_page INTEGER NOT NULL DEFAULT 0,
      total_pages INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, lesson_id)
    );
    CREATE INDEX IF NOT EXISTS idx_progress_program ON lesson_progress(program_id);
    CREATE INDEX IF NOT EXISTS idx_progress_lesson ON lesson_progress(lesson_id);
    CREATE TABLE IF NOT EXISTS student_block_work (
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'image',
      current TEXT NOT NULL DEFAULT '{}',
      history TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, lesson_id, block_id)
    );
    CREATE INDEX IF NOT EXISTS idx_work_lesson ON student_block_work(lesson_id);

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      author_id TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{"blocks":[]}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_program ON posts(program_id, updated_at);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      author_id TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{"blocks":[]}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_program ON announcements(program_id, updated_at);

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      author_avatar TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'student',
      text TEXT NOT NULL DEFAULT '',
      secret INTEGER NOT NULL DEFAULT 0,
      attachments TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, created_at);

    CREATE TABLE IF NOT EXISTS drills (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'practice',
      provider TEXT NOT NULL DEFAULT 'chatgpt',
      title TEXT NOT NULL,
      mission TEXT NOT NULL DEFAULT '',
      author_id TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drills_program ON drills(program_id, updated_at);

    CREATE TABLE IF NOT EXISTS usage_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'text',
      model TEXT NOT NULL DEFAULT '',
      model_label TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      cost_usd REAL NOT NULL DEFAULT 0,
      krw_per_usd REAL NOT NULL DEFAULT 0,
      credits REAL NOT NULL DEFAULT 0,
      gen_ms INTEGER NOT NULL DEFAULT 0,
      ok INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      output TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
  `);
    migrateUsers(db);
    migrateChat(db);
    migrateComments(db);
    migrateUsage(db);
    seedIfEmpty(db);
    seedUsersIfEmpty(db);
    seedProgramsIfEmpty(db);
    seedUsageIfEmpty(db);
    backfillUserIds(db, "chat_messages", "nickname");
    backfillUserIds(db, "post_comments", "author_name");
    return db;
}

/** Add the `avatar` column to pre-existing `users` tables + backfill demo avatars. */
function migrateUsers(database: Database.Database) {
    const cols = database.prepare("PRAGMA table_info(users)").all() as {
        name: string;
    }[];
    if (cols.some((c) => c.name === "avatar")) return;
    database.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''");
    const set = database.prepare(
        "UPDATE users SET avatar = ? WHERE id = ? AND avatar = ''",
    );
    set.run("bear", "teacher");
    set.run("rabbit", "kim");
    set.run("cat", "lee");
}

/** Add `avatar` + `user_id` columns to pre-existing `chat_messages` tables. */
function migrateChat(database: Database.Database) {
    const names = new Set(
        (
            database.prepare("PRAGMA table_info(chat_messages)").all() as {
                name: string;
            }[]
        ).map((c) => c.name),
    );
    if (!names.has("avatar")) {
        database.exec(
            "ALTER TABLE chat_messages ADD COLUMN avatar TEXT NOT NULL DEFAULT ''",
        );
    }
    if (!names.has("user_id")) {
        database.exec(
            "ALTER TABLE chat_messages ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
        );
    }
    if (!names.has("reactions")) {
        database.exec(
            "ALTER TABLE chat_messages ADD COLUMN reactions TEXT NOT NULL DEFAULT '{}'",
        );
    }
}

/** 기존 post_comments 테이블에 parent_id 컬럼(대댓글용)을 더한다. 컬럼이 이미
  *  있으면 아무것도 안 하므로 반복 실행해도 안전하다. */
function migrateComments(database: Database.Database) {
    const names = new Set(
        (
            database.prepare("PRAGMA table_info(post_comments)").all() as {
                name: string;
            }[]
        ).map((c) => c.name),
    );
    if (!names.has("parent_id")) {
        database.exec(
            "ALTER TABLE post_comments ADD COLUMN parent_id TEXT NOT NULL DEFAULT ''",
        );
    }
    // 댓글 첨부(채팅과 동일 규격)를 담는 컬럼. 구 DB에는 없으므로 여기서 더한다.
    if (!names.has("attachments")) {
        database.exec(
            "ALTER TABLE post_comments ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'",
        );
    }
    // 컬럼이 보장된 뒤 인덱스를 만든다. 신규 DB는 parent_id가 처음부터 있고,
    // 구 DB는 위 ALTER로 막 추가됐으므로 두 경우 모두 안전하다. 이 인덱스를
    // 기본 스키마 exec에 두면 구 DB 부팅 시 컬럼이 없어 크래시하므로 여기서 만든다.
    database.exec(
        "CREATE INDEX IF NOT EXISTS idx_comments_parent ON post_comments(parent_id)",
    );
}

/** 기존 usage_log 테이블에 결과물(output)·종류(kind) 컬럼을 더한다. 컬럼이 이미
  *  있으면 아무것도 안 하므로 반복 실행해도 안전하다(멱등). 이 컬럼들이 있어야
  *  사용량 기록에서 결과물을 다시 열어 볼 수 있다. */
function migrateUsage(database: Database.Database) {
    const names = new Set(
        (
            database.prepare("PRAGMA table_info(usage_log)").all() as {
                name: string;
            }[]
        ).map((c) => c.name),
    );
    if (!names.has("output")) {
        database.exec(
            "ALTER TABLE usage_log ADD COLUMN output TEXT NOT NULL DEFAULT ''",
        );
    }
    if (!names.has("kind")) {
        database.exec(
            "ALTER TABLE usage_log ADD COLUMN kind TEXT NOT NULL DEFAULT ''",
        );
    }
}

/** 레거시 행의 빈 user_id를 표시 이름↔현재 계정 매칭으로 채운다(채팅·댓글 공용).
  *  user_id가 없으면 라이브 프로필 조인이 안 되어 남들이 옛 아바타/이름 스냅샷을
  *  계속 보게 된다. 계정 시드 이후에 실행하며, 반복 실행해도 안전(멱등)하다.
  *  table·nameColumn 은 내부 호출의 고정 식별자라 SQL 인젝션 위험이 없다. */
function backfillUserIds(
    database: Database.Database,
    table: string,
    nameColumn: string,
) {
    database.exec(`
    UPDATE ${table}
    SET user_id = (
      SELECT u.id FROM users u
      WHERE u.name = ${table}.${nameColumn}
      ORDER BY u.created_at ASC LIMIT 1
    )
    WHERE (user_id IS NULL OR user_id = '')
      AND EXISTS (SELECT 1 FROM users u WHERE u.name = ${table}.${nameColumn});
  `);
}

export const db: Database.Database =
    global.__maketorDb ?? (global.__maketorDb = createDb());

// ---------- courses ----------

interface CourseRow {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    author_nickname: string;
    data: string;
    created_at: number;
    updated_at: number;
}

function rowToCourse(row: CourseRow): Course {
    const parsed = JSON.parse(row.data) as { pages: Page[]; maxWidth?: Course["maxWidth"] };
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        cover: row.cover,
        authorNickname: row.author_nickname,
        pages: parsed.pages ?? [],
        maxWidth: parsed.maxWidth,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function listCourses(): CourseSummary[] {
    const rows = db
        .prepare("SELECT * FROM courses ORDER BY updated_at DESC")
        .all() as CourseRow[];
    return rows.map((row) => {
        const parsed = JSON.parse(row.data) as { pages: Page[] };
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            cover: row.cover,
            authorNickname: row.author_nickname,
            pageCount: parsed.pages?.length ?? 0,
            updatedAt: row.updated_at,
        };
    });
}

export function getCourse(id: string): Course | null {
    const row = db
        .prepare("SELECT * FROM courses WHERE id = ?")
        .get(id) as CourseRow | undefined;
    return row ? rowToCourse(row) : null;
}

export function upsertCourse(course: Course): Course {
    const now = Date.now();
    const existing = db
        .prepare("SELECT created_at FROM courses WHERE id = ?")
        .get(course.id) as { created_at: number } | undefined;
    const createdAt = existing?.created_at ?? course.createdAt ?? now;
    const data = JSON.stringify({ pages: course.pages, maxWidth: course.maxWidth });
    db.prepare(
        `INSERT INTO courses (id, title, description, cover, author_nickname, data, created_at, updated_at)
     VALUES (@id, @title, @description, @cover, @author_nickname, @data, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       title = @title, description = @description, cover = @cover,
       author_nickname = @author_nickname, data = @data, updated_at = @updated_at`,
    ).run({
        id: course.id,
        title: course.title,
        description: course.description,
        cover: course.cover,
        author_nickname: course.authorNickname,
        data,
        created_at: createdAt,
        updated_at: now,
    });
    return getCourse(course.id)!;
}

export function deleteCourse(id: string): void {
    db.prepare("DELETE FROM courses WHERE id = ?").run(id);
    db.prepare("DELETE FROM chat_messages WHERE course_id = ?").run(id);
}

// ---------- chat ----------

interface ChatRow {
    id: string;
    course_id: string;
    user_id: string;
    nickname: string;
    role: string;
    avatar: string;
    live_avatar?: string | null; // joined current avatar from users (read only)
    live_name?: string | null; // joined current display name from users (read only)
    live_role?: string | null; // joined current role from users (read only)
    text: string;
    attachments: string;
    reactions: string;
    created_at: number;
}

function rowToMessage(row: ChatRow): ChatMessage {
    // 보낸 사람의 현재 프로필(users 테이블을 user_id로 라이브 조인)을 우선 사용해
    // 아바타·표시 이름 변경이 본인뿐 아니라 모두에게 반영되도록 한다. 매칭되는
    // 계정이 없는 레거시 행은 전송 시점 스냅샷으로 폴백한다.
    const avatar = row.live_avatar != null ? row.live_avatar : row.avatar ?? "";
    const nickname =
        row.live_name != null && row.live_name !== "" ? row.live_name : row.nickname;
    const role = (row.live_name != null && row.live_role != null && row.live_role !== ""
        ? row.live_role
        : row.role) as ChatMessage["role"];
    return {
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id ?? "",
        nickname,
        role,
        avatar,
        text: row.text,
        attachments: JSON.parse(row.attachments),
        reactions: parseReactions(row.reactions),
        createdAt: row.created_at,
    };
}

// reactions JSON 문자열을 안전하게 파싱한다(레거시 NULL·깨진 값은 빈 객체로).
function parseReactions(raw: string | null | undefined): Record<string, string[]> {
    if (!raw) return {};
    try {
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? (obj as Record<string, string[]>) : {};
    } catch {
        return {};
    }
}

export function getMessages(courseId: string, since = 0): ChatMessage[] {
    const rows = db
        .prepare(
            "SELECT cm.*, u.avatar AS live_avatar, u.name AS live_name, u.role AS live_role FROM chat_messages cm LEFT JOIN users u ON u.id = cm.user_id WHERE cm.course_id = ? AND cm.created_at > ? ORDER BY cm.created_at ASC LIMIT 200",
        )
        .all(courseId, since) as ChatRow[];
    return rows.map(rowToMessage);
}

export function addMessage(
    msg: Omit<ChatMessage, "id" | "createdAt"> & { id?: string; createdAt?: number },
): ChatMessage {
    const row: ChatRow = {
        id: msg.id ?? crypto.randomUUID(),
        course_id: msg.courseId,
        user_id: msg.userId ?? "",
        nickname: msg.nickname,
        role: msg.role,
        avatar: msg.avatar ?? "",
        text: msg.text,
        attachments: JSON.stringify(msg.attachments ?? []),
        reactions: JSON.stringify(msg.reactions ?? {}),
        created_at: msg.createdAt ?? Date.now(),
    };
    db.prepare(
        `INSERT INTO chat_messages (id, course_id, user_id, nickname, role, avatar, text, attachments, reactions, created_at)
     VALUES (@id, @course_id, @user_id, @nickname, @role, @avatar, @text, @attachments, @reactions, @created_at)`,
    ).run(row);
    return rowToMessage(row);
}

// 한 메시지의 이모지 반응을 토글한다(같은 사용자가 같은 이모지를 다시 누르면 취소).
// 갱신된 메시지를 반환하고, 메시지가 없으면 null을 반환한다.
export function toggleReaction(
    courseId: string,
    messageId: string,
    userId: string,
    emoji: string,
): ChatMessage | null {
    const row = db
        .prepare(
            "SELECT cm.*, u.avatar AS live_avatar, u.name AS live_name, u.role AS live_role FROM chat_messages cm LEFT JOIN users u ON u.id = cm.user_id WHERE cm.id = ? AND cm.course_id = ?",
        )
        .get(messageId, courseId) as ChatRow | undefined;
    if (!row) return null;

    const reactions = parseReactions(row.reactions);
    const users = reactions[emoji] ?? [];
    const has = users.includes(userId);
    const next = has ? users.filter((u) => u !== userId) : [...users, userId];
    if (next.length === 0) {
        delete reactions[emoji];
    } else {
        reactions[emoji] = next;
    }

    db.prepare("UPDATE chat_messages SET reactions = ? WHERE id = ?").run(
        JSON.stringify(reactions),
        messageId,
    );
    return rowToMessage({ ...row, reactions: JSON.stringify(reactions) });
}

// ---------- seed ----------

function seedIfEmpty(database: Database.Database) {
    const count = database.prepare("SELECT COUNT(*) AS n FROM courses").get() as {
        n: number;
    };
    if (count.n > 0) return;
    const now = Date.now();
    const demo = {
        pages: [
            {
                id: "p1",
                title: "환영합니다",
                blocks: [
                    { id: "b1", type: "heading", level: 1, text: "Instructorly에 오신 것을 환영합니다" },
                    {
                        id: "b2",
                        type: "text",
                        markdown:
                            "이 강의는 **AI 강사 만들기** 데모예요.\n\n오른쪽 위 **글자 크기** 버튼으로 화면 글씨를 크게 키울 수 있습니다. 천천히 따라오세요. 🙂",
                    },
                    {
                        id: "b3",
                        type: "callout",
                        emoji: "💡",
                        text: "아래 이미지 블럭의 [실행] 버튼을 누르면 진짜로 그림이 만들어집니다. 몇 초 걸렸는지도 보여줘요.",
                    },
                    {
                        id: "b4",
                        type: "image",
                        prompt: "따뜻한 햇살이 들어오는 아늑한 교실, 수채화풍, 친근한 분위기",
                        imageUrl: null,
                        seed: 42,
                        genMs: null,
                    },
                ],
            },
            {
                id: "p2",
                title: "AI에게 질문하기",
                blocks: [
                    { id: "b5", type: "heading", level: 2, text: "LLM 블럭 사용법" },
                    {
                        id: "b6",
                        type: "text",
                        markdown: "아래 칸에 궁금한 것을 적고 **실행**을 누르면 AI가 대답해 줍니다.",
                    },
                    {
                        id: "b7",
                        type: "llm",
                        prompt: "노인분들께 스마트폰으로 사진을 잘 찍는 법을 아주 쉽게 3단계로 알려줘",
                        output: null,
                        genMs: null,
                    },
                ],
            },
        ],
    };
    database
        .prepare(
            `INSERT INTO courses (id, title, description, cover, author_nickname, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            "demo-welcome",
            "Instructorly 둘러보기",
            "처음 오셨나요? 이 강의로 Instructorly의 기능을 천천히 익혀 보세요.",
            null,
            "Instructorly 팀",
            JSON.stringify(demo),
            now,
            now,
        );
}

// ========================= users (accounts) =========================

interface UserRow {
    id: string;
    password: string;
    name: string;
    role: string;
    avatar: string;
    created_at: number;
}

function rowToUser(r: UserRow): User {
    return {
        id: r.id,
        password: r.password,
        name: r.name,
        role: r.role as Role,
        avatar: r.avatar ?? "",
        createdAt: r.created_at,
    };
}

function toPublic(u: User): UserPublic {
    return { id: u.id, name: u.name, role: u.role, avatar: u.avatar };
}

export function getUser(id: string): User | null {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id.trim()) as
        | UserRow
        | undefined;
    return row ? rowToUser(row) : null;
}

export function createUser(input: {
    id: string;
    password: string;
    name: string;
    role: Role;
    avatar?: string;
}): UserPublic {
    const id = input.id.trim();
    if (!id) throw new Error("아이디를 입력해 주세요.");
    if (!input.password) throw new Error("비밀번호를 입력해 주세요.");
    if (getUser(id)) throw new Error("이미 사용 중인 아이디입니다.");
    const user: User = {
        id,
        password: input.password,
        name: input.name.trim() || id,
        role: input.role === "instructor" ? "instructor" : "student",
        avatar: input.avatar ?? "",
        createdAt: Date.now(),
    };
    db.prepare(
        "INSERT INTO users (id, password, name, role, avatar, created_at) VALUES (@id, @password, @name, @role, @avatar, @createdAt)",
    ).run(user);
    return toPublic(user);
}

/** Update a user's display name and/or avatar; keeps enrollment names in sync. */
export function updateUserProfile(
    id: string,
    patch: { name?: string; avatar?: string },
): UserPublic | null {
    const u = getUser(id);
    if (!u) return null;
    const name = patch.name?.trim() ? patch.name.trim() : u.name;
    const avatar = patch.avatar !== undefined ? patch.avatar : u.avatar;
    db.prepare("UPDATE users SET name = ?, avatar = ? WHERE id = ?").run(
        name,
        avatar,
        id,
    );
    if (name !== u.name) {
        db.prepare("UPDATE enrollments SET name = ? WHERE user_id = ?").run(name, id);
    }
    return { id: u.id, name, role: u.role, avatar };
}

export function verifyUser(id: string, password: string): UserPublic | null {
    const u = getUser(id);
    if (!u || u.password !== password) return null;
    return toPublic(u);
}

/** Type-ahead search by id or name, optionally constrained to a role. */
export function searchUsers(q: string, role?: Role, limit = 10): UserPublic[] {
    const like = `%${q.trim()}%`;
    const rows = (
        role
            ? db
                    .prepare(
                        "SELECT * FROM users WHERE role = ? AND (id LIKE ? OR name LIKE ?) ORDER BY id LIMIT ?",
                    )
                    .all(role, like, like, limit)
            : db
                    .prepare(
                        "SELECT * FROM users WHERE id LIKE ? OR name LIKE ? ORDER BY id LIMIT ?",
                    )
                    .all(like, like, limit)
    ) as UserRow[];
    return rows.map((r) => toPublic(rowToUser(r)));
}

// ========================= programs (강좌) =========================

interface ProgramRow {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    owner_id: string;
    owner_name: string;
    invite_code: string;
    data: string;
    created_at: number;
    updated_at: number;
}

/** Ensure every week carries a unified `items` list. Legacy weeks that only
  *  have `lessonIds` are migrated to `items` (lessons first), and `lessonIds`
  *  is kept in sync so any remaining legacy reader still works. */
function normalizeWeek(w: Week): Week {
    const items: WeekItem[] =
        Array.isArray(w.items) && w.items.length > 0
            ? w.items
            : (w.lessonIds ?? []).map((id) => ({ type: "lesson" as const, id }));
    const lessonIds = items.filter((it) => it.type === "lesson").map((it) => it.id);
    return { id: w.id, weekNo: w.weekNo, title: w.title, items, lessonIds };
}

function rowToProgram(r: ProgramRow): Program {
    const parsed = JSON.parse(r.data) as {
        weeks: Week[];
        startDate?: string | null;
        endDate?: string | null;
        weekDays?: number[];
    };
    return {
        id: r.id,
        title: r.title,
        description: r.description,
        cover: r.cover,
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        inviteCode: r.invite_code,
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null,
        weekDays: Array.isArray(parsed.weekDays) ? parsed.weekDays : [],
        weeks: (parsed.weeks ?? []).map(normalizeWeek),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function studentCount(programId: string): number {
    const r = db
        .prepare("SELECT COUNT(*) AS n FROM enrollments WHERE program_id = ?")
        .get(programId) as { n: number };
    return r.n;
}

function summarize(p: Program): ProgramSummary {
    const lessonCount = p.weeks.reduce(
        (s, w) => s + w.items.filter((it) => it.type === "lesson").length,
        0,
    );
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        cover: p.cover,
        ownerId: p.ownerId,
        ownerName: p.ownerName,
        startDate: p.startDate,
        endDate: p.endDate,
        weekDays: p.weekDays,
        weekCount: p.weeks.length,
        lessonCount,
        studentCount: studentCount(p.id),
        updatedAt: p.updatedAt,
    };
}

export function getProgram(id: string): Program | null {
    const row = db.prepare("SELECT * FROM programs WHERE id = ?").get(id) as
        | ProgramRow
        | undefined;
    return row ? rowToProgram(row) : null;
}

export function listProgramsForInstructor(ownerId: string): ProgramSummary[] {
    const rows = db
        .prepare("SELECT * FROM programs WHERE owner_id = ? ORDER BY updated_at DESC")
        .all(ownerId) as ProgramRow[];
    return rows.map((r) => summarize(rowToProgram(r)));
}

export function listProgramsForStudent(userId: string): ProgramSummary[] {
    const rows = db
        .prepare(
            `SELECT p.* FROM programs p
       JOIN enrollments e ON e.program_id = p.id
       WHERE e.user_id = ? ORDER BY p.updated_at DESC`,
        )
        .all(userId) as ProgramRow[];
    return rows.map((r) => summarize(rowToProgram(r)));
}

export function listAllPrograms(): ProgramSummary[] {
    const rows = db
        .prepare("SELECT * FROM programs ORDER BY updated_at DESC")
        .all() as ProgramRow[];
    return rows.map((r) => summarize(rowToProgram(r)));
}

function genInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++)
        s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

export function createProgram(input: {
    title: string;
    description?: string;
    ownerId: string;
    ownerName: string;
    startDate?: string | null;
    endDate?: string | null;
    weekDays?: number[];
}): Program {
    const now = Date.now();
    const program: Program = {
        id: crypto.randomUUID(),
        title: input.title.trim() || "새 강좌",
        description: input.description?.trim() ?? "",
        cover: null,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        inviteCode: genInviteCode(),
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        weekDays: Array.isArray(input.weekDays) ? input.weekDays : [],
        weeks: [
            { id: crypto.randomUUID(), weekNo: 1, title: "1주차", items: [], lessonIds: [] },
        ],
        createdAt: now,
        updatedAt: now,
    };
    return upsertProgram(program);
}

export function upsertProgram(program: Program): Program {
    const now = Date.now();
    const existing = db
        .prepare("SELECT created_at FROM programs WHERE id = ?")
        .get(program.id) as { created_at: number } | undefined;
    const createdAt = existing?.created_at ?? program.createdAt ?? now;
    const data = JSON.stringify({
        weeks: program.weeks.map(normalizeWeek),
        startDate: program.startDate ?? null,
        endDate: program.endDate ?? null,
        weekDays: Array.isArray(program.weekDays) ? program.weekDays : [],
    });
    db.prepare(
        `INSERT INTO programs (id, title, description, cover, owner_id, owner_name, invite_code, data, created_at, updated_at)
     VALUES (@id, @title, @description, @cover, @owner_id, @owner_name, @invite_code, @data, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       title = @title, description = @description, cover = @cover,
       owner_name = @owner_name, invite_code = @invite_code, data = @data, updated_at = @updated_at`,
    ).run({
        id: program.id,
        title: program.title,
        description: program.description,
        cover: program.cover,
        owner_id: program.ownerId,
        owner_name: program.ownerName,
        invite_code: program.inviteCode,
        data,
        created_at: createdAt,
        updated_at: now,
    });
    return getProgram(program.id)!;
}

export function deleteProgram(id: string): void {
    // Cascade-remove posts (and their comments) + announcements owned by this program.
    const postIds = db
        .prepare("SELECT id FROM posts WHERE program_id = ?")
        .all(id) as { id: string }[];
    const delComments = db.prepare("DELETE FROM post_comments WHERE post_id = ?");
    for (const p of postIds) delComments.run(p.id);
    db.prepare("DELETE FROM posts WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM announcements WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM drills WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM programs WHERE id = ?").run(id);
    db.prepare("DELETE FROM enrollments WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM lesson_progress WHERE program_id = ?").run(id);
}

// ========================= enrollments =========================

interface EnrollRow {
    program_id: string;
    user_id: string;
    name: string;
    avatar?: string | null; // joined live avatar from users (read only)
    enrolled_at: number;
}

function rowToEnrollment(r: EnrollRow): Enrollment {
    return {
        programId: r.program_id,
        userId: r.user_id,
        name: r.name,
        avatar: r.avatar ?? "",
        enrolledAt: r.enrolled_at,
    };
}

export function listEnrollments(programId: string): Enrollment[] {
    const rows = db
        .prepare(
            "SELECT e.*, u.avatar AS avatar FROM enrollments e LEFT JOIN users u ON u.id = e.user_id WHERE e.program_id = ? ORDER BY e.enrolled_at ASC",
        )
        .all(programId) as EnrollRow[];
    return rows.map(rowToEnrollment);
}

/** Enroll a known student account. Returns null if the user id does not exist. */
export function enrollStudent(
    programId: string,
    userId: string,
): Enrollment | null {
    const u = getUser(userId);
    if (!u) return null;
    const at = Date.now();
    db.prepare(
        "INSERT OR IGNORE INTO enrollments (program_id, user_id, name, enrolled_at) VALUES (?, ?, ?, ?)",
    ).run(programId, u.id, u.name, at);
    return { programId, userId: u.id, name: u.name, avatar: u.avatar, enrolledAt: at };
}

export function unenrollStudent(programId: string, userId: string): void {
    db.prepare(
        "DELETE FROM enrollments WHERE program_id = ? AND user_id = ?",
    ).run(programId, userId);
}

/** Self-join via invite code. Returns the joined program or null if no match. */
export function enrollByInvite(code: string, userId: string): Program | null {
    const row = db
        .prepare("SELECT * FROM programs WHERE invite_code = ?")
        .get(code.trim().toUpperCase()) as ProgramRow | undefined;
    if (!row) return null;
    enrollStudent(row.id, userId);
    return rowToProgram(row);
}

// ========================= progress =========================

interface ProgressRow {
    user_id: string;
    lesson_id: string;
    program_id: string;
    max_page: number;
    total_pages: number;
    completed: number;
    updated_at: number;
}

function rowToProgress(r: ProgressRow): LessonProgress {
    return {
        userId: r.user_id,
        lessonId: r.lesson_id,
        programId: r.program_id,
        maxPageReached: r.max_page,
        totalPages: r.total_pages,
        completed: !!r.completed,
        updatedAt: r.updated_at,
    };
}

/** Record the furthest page a student reached in a lesson (monotonic). */
export function recordProgress(input: {
    userId: string;
    lessonId: string;
    programId?: string;
    page: number;
    totalPages: number;
}): LessonProgress {
    const existing = db
        .prepare("SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?")
        .get(input.userId, input.lessonId) as ProgressRow | undefined;
    const maxPage = Math.max(existing?.max_page ?? 0, input.page);
    const total = input.totalPages || existing?.total_pages || 0;
    const completed =
        total > 0 && maxPage >= total - 1 ? 1 : existing?.completed ?? 0;
    const programId = input.programId || existing?.program_id || "";
    const now = Date.now();
    db.prepare(
        `INSERT INTO lesson_progress (user_id, lesson_id, program_id, max_page, total_pages, completed, updated_at)
     VALUES (@user_id, @lesson_id, @program_id, @max_page, @total_pages, @completed, @updated_at)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       program_id = @program_id, max_page = @max_page, total_pages = @total_pages,
       completed = @completed, updated_at = @updated_at`,
    ).run({
        user_id: input.userId,
        lesson_id: input.lessonId,
        program_id: programId,
        max_page: maxPage,
        total_pages: total,
        completed,
        updated_at: now,
    });
    return rowToProgress(
        db
            .prepare(
                "SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?",
            )
            .get(input.userId, input.lessonId) as ProgressRow,
    );
}

export function getStudentProgress(
    userId: string,
    programId?: string,
): LessonProgress[] {
    const rows = (
        programId
            ? db
                    .prepare(
                        "SELECT * FROM lesson_progress WHERE user_id = ? AND program_id = ?",
                    )
                    .all(userId, programId)
            : db
                    .prepare("SELECT * FROM lesson_progress WHERE user_id = ?")
                    .all(userId)
    ) as ProgressRow[];
    return rows.map(rowToProgress);
}

export function getProgramProgress(programId: string): LessonProgress[] {
    const rows = db
        .prepare("SELECT * FROM lesson_progress WHERE program_id = ?")
        .all(programId) as ProgressRow[];
    return rows.map(rowToProgress);
}

export function getLessonProgress(lessonId: string): LessonProgress[] {
    const rows = db
        .prepare("SELECT * FROM lesson_progress WHERE lesson_id = ?")
        .all(lessonId) as ProgressRow[];
    return rows.map(rowToProgress);
}

// ========================= student block work =========================

interface WorkRow {
    user_id: string;
    lesson_id: string;
    block_id: string;
    block_type: string;
    current: string;
    history: string;
    updated_at: number;
}

function rowToWork(r: WorkRow): StudentBlockWork {
    return {
        userId: r.user_id,
        lessonId: r.lesson_id,
        blockId: r.block_id,
        blockType: r.block_type as "image" | "llm",
        current: JSON.parse(r.current) as BlockRun,
        history: JSON.parse(r.history) as BlockRun[],
        updatedAt: r.updated_at,
    };
}

export function getStudentWork(
    userId: string,
    lessonId: string,
): StudentBlockWork[] {
    const rows = db
        .prepare(
            "SELECT * FROM student_block_work WHERE user_id = ? AND lesson_id = ?",
        )
        .all(userId, lessonId) as WorkRow[];
    return rows.map(rowToWork);
}

/** All students' work for a lesson — the instructor's review feed. */
export function getLessonWork(lessonId: string): StudentBlockWork[] {
    const rows = db
        .prepare(
            "SELECT * FROM student_block_work WHERE lesson_id = ? ORDER BY user_id, updated_at DESC",
        )
        .all(lessonId) as WorkRow[];
    return rows.map(rowToWork);
}

/** 한 학생이 모든 강의에서 만든 작업을 최신순으로 — 자랑방 작품 보관함용. */
export function getAllStudentWork(userId: string): StudentBlockWork[] {
    const rows = db
        .prepare(
            "SELECT * FROM student_block_work WHERE user_id = ? ORDER BY updated_at DESC",
        )
        .all(userId) as WorkRow[];
    return rows.map(rowToWork);
}

/**
  * Persist a student's latest prompt/result for a block. When `appendHistory`
  * is set and the run actually produced a result, the run is also prepended to
  * the block's history (capped at 50 entries).
  */
export function saveStudentWork(input: {
    userId: string;
    lessonId: string;
    blockId: string;
    blockType: "image" | "video" | "audio" | "llm";
    run: BlockRun;
    appendHistory?: boolean;
}): StudentBlockWork {
    const existing = db
        .prepare(
            "SELECT * FROM student_block_work WHERE user_id = ? AND lesson_id = ? AND block_id = ?",
        )
        .get(input.userId, input.lessonId, input.blockId) as WorkRow | undefined;
    const prevHistory: BlockRun[] = existing
        ? (JSON.parse(existing.history) as BlockRun[])
        : [];
    const history =
        input.appendHistory && input.run.result != null
            ? [input.run, ...prevHistory].slice(0, 50)
            : prevHistory;
    const now = Date.now();
    db.prepare(
        `INSERT INTO student_block_work (user_id, lesson_id, block_id, block_type, current, history, updated_at)
     VALUES (@user_id, @lesson_id, @block_id, @block_type, @current, @history, @updated_at)
     ON CONFLICT(user_id, lesson_id, block_id) DO UPDATE SET
       block_type = @block_type, current = @current, history = @history, updated_at = @updated_at`,
    ).run({
        user_id: input.userId,
        lesson_id: input.lessonId,
        block_id: input.blockId,
        block_type: input.blockType,
        current: JSON.stringify(input.run),
        history: JSON.stringify(history),
        updated_at: now,
    });
    return rowToWork(
        db
            .prepare(
                "SELECT * FROM student_block_work WHERE user_id = ? AND lesson_id = ? AND block_id = ?",
            )
            .get(input.userId, input.lessonId, input.blockId) as WorkRow,
    );
}

// ========================= seeds (accounts + demo program) =========================

function seedUsersIfEmpty(database: Database.Database) {
    const count = database.prepare("SELECT COUNT(*) AS n FROM users").get() as {
        n: number;
    };
    if (count.n > 0) return;
    const now = Date.now();
    const insert = database.prepare(
        "INSERT INTO users (id, password, name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insert.run("teacher", "1234", "박성현", "instructor", "bear", now);
    insert.run("kim", "1234", "김복희", "student", "rabbit", now);
    insert.run("lee", "1234", "이순자", "student", "cat", now);
}

function seedProgramsIfEmpty(database: Database.Database) {
    const count = database.prepare("SELECT COUNT(*) AS n FROM programs").get() as {
        n: number;
    };
    if (count.n > 0) return;
    const now = Date.now();
    const id = "demo-program";
    const weeks = [
        {
            id: "w1",
            weekNo: 1,
            title: "1주차 — 시작하기",
            items: [{ type: "lesson", id: "demo-welcome" }],
            lessonIds: ["demo-welcome"],
        },
    ];
    database
        .prepare(
            `INSERT INTO programs (id, title, description, cover, owner_id, owner_name, invite_code, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            id,
            "AI 강사 입문 강좌",
            "Instructorly로 AI 강의를 만드는 첫 강좌예요. 주차별로 따라오세요.",
            null,
            "teacher",
            "박성현",
            "DEMO01",
            JSON.stringify({ weeks }),
            now,
            now,
        );
    const enroll = database.prepare(
        "INSERT OR IGNORE INTO enrollments (program_id, user_id, name, enrolled_at) VALUES (?, ?, ?, ?)",
    );
    enroll.run(id, "kim", "김복희", now);
    enroll.run(id, "lee", "이순자", now);
}

// ========================= seed (AI 스튜디오 데모 사용량) =========================

/** 데모용 이미지 결과물 — 라벨이 박힌 작은 SVG를 data URL로 만든다(외부 의존 없음). */
function demoSvgDataUrl(label: string, color: string): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'><rect width='100%' height='100%' fill='${color}'/><text x='50%' y='50%' fill='white' font-size='18' font-family='sans-serif' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 데모용 오디오 결과물 — 짧은 사인파 톤을 8비트 WAV data URL로 합성한다(외부 의존 없음). */
function demoToneWavDataUrl(freqHz: number, ms: number): string {
    const sampleRate = 8000;
    const n = Math.floor((sampleRate * ms) / 1000);
    const buf = Buffer.alloc(44 + n);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + n, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate, 28); // byte rate(8비트 모노)
    buf.writeUInt16LE(1, 32); // block align
    buf.writeUInt16LE(8, 34); // bits per sample
    buf.write("data", 36);
    buf.writeUInt32LE(n, 40);
    for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        // 앞뒤 20ms 페이드로 클릭음을 줄인다.
        const env = Math.min(1, Math.min(i, n - i) / (sampleRate * 0.02));
        const v = Math.sin(2 * Math.PI * freqHz * t) * env;
        buf[44 + i] = Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
    }
    return `data:audio/wav;base64,${buf.toString("base64")}`;
}

/** usage_log가 비어 있으면 데모 사용량(여러 날짜·모델·종류 + 열어 볼 결과물)을 한 번 채운다.
  *  프로토타입에서 /studio 대시보드(차트·기록·결과물 보기)를 바로 둘러볼 수 있게 한다. */
function seedUsageIfEmpty(database: Database.Database) {
    const count = database.prepare("SELECT COUNT(*) AS n FROM usage_log").get() as {
        n: number;
    };
    if (count.n > 0) return;

    const krwPerUsd = 1380; // 데모 고정 환율(USD→KRW)
    const users = [
        { id: "teacher", name: "박성현" },
        { id: "kim", name: "김복희" },
        { id: "lee", name: "이순자" },
    ];
    // 결과물 토큰("IMG"/"WAV")은 삽입 시 실제 data URL로 치환한다.
    const templates: {
        category: string;
        model: string;
        label: string;
        prompt: string;
        usd: number;
        output: string;
        color?: string;
    }[] = [
        {
            category: "text",
            model: "openai/gpt-5.5",
            label: "GPT-5.5",
            prompt: "노인분들께 스마트폰으로 사진 잘 찍는 법을 3단계로 쉽게 알려줘",
            usd: 0.012,
            output:
                "# 스마트폰 사진 잘 찍는 3단계\n\n1. **빛을 등지지 마세요** — 해를 마주 보고 찍으면 인물이 어두워져요.\n2. **두 손으로 잡고 숨을 잠깐 멈추세요** — 흔들림이 줄어 또렷해집니다.\n3. **줌 대신 가까이 다가가세요** — 직접 다가가면 훨씬 선명해요.\n\n천천히 연습해 보세요! 🙂",
        },
        {
            category: "text",
            model: "anthropic/claude-sonnet-4.6",
            label: "Claude Sonnet 4.6",
            prompt: "가을 정원을 묘사하는 짧은 시 한 편",
            usd: 0.008,
            output:
                "단풍이 물든 오후,\n바람이 마른 잎을 쓸어가고\n국화 향이 담장을 넘는다.\n\n가을은 그렇게\n조용히 깊어 간다.",
        },
        {
            category: "image",
            model: "google/nano-banana-2",
            label: "Nano Banana 2",
            prompt: "따뜻한 햇살이 드는 아늑한 교실, 수채화풍",
            usd: 0.04,
            output: "IMG",
            color: "#6366f1",
        },
        {
            category: "image",
            model: "black-forest-labs/flux.1",
            label: "FLUX.1",
            prompt: "노을 지는 바닷가, 미니멀 일러스트",
            usd: 0.035,
            output: "IMG",
            color: "#f59e0b",
        },
        {
            category: "video",
            model: "google/veo-3.1-fast",
            label: "Veo 3.1 Fast",
            prompt: "파도가 잔잔히 밀려오는 해변의 짧은 클립",
            usd: 0.6,
            output: "https://youtu.be/aqz-KE-bpKQ",
        },
        {
            category: "audio",
            model: "openai/gpt-audio",
            label: "GPT Audio",
            prompt: "잔잔한 피아노 한 마디",
            usd: 0.02,
            output: "WAV",
        },
    ];

    const insert = database.prepare(
        `INSERT INTO usage_log
           (id, user_id, user_name, category, model, model_label, prompt,
            cost_usd, krw_per_usd, credits, gen_ms, ok, created_at, output, kind)
         VALUES
           (@id, @user_id, @user_name, @category, @model, @model_label, @prompt,
            @cost_usd, @krw_per_usd, @credits, @gen_ms, @ok, @created_at, @output, @kind)`,
    );

    const now = Date.now();
    const DAY = 86_400_000;
    let seq = 0;
    // 최근 14일에 걸쳐 하루 1~4건을 흩뿌린다(차트가 풍성하게 보이도록).
    for (let d = 13; d >= 0; d--) {
        const perDay = 1 + Math.floor(Math.random() * 4);
        for (let k = 0; k < perDay; k++) {
            const t = templates[Math.floor(Math.random() * templates.length)];
            const u = users[seq % users.length];
            const usd = Number((t.usd * (0.6 + Math.random() * 0.8)).toFixed(4));
            const credits = (usd * krwPerUsd) / 0.1;
            let output = t.output;
            if (output === "IMG") output = demoSvgDataUrl(t.label, t.color ?? "#6366f1");
            else if (output === "WAV") output = demoToneWavDataUrl(300 + (seq % 5) * 70, 700);
            const createdAt =
                now - d * DAY - Math.floor(Math.random() * 12 * 3_600_000);
            insert.run({
                id: crypto.randomUUID(),
                user_id: u.id,
                user_name: u.name,
                category: t.category,
                model: t.model,
                model_label: t.label,
                prompt: t.prompt,
                cost_usd: usd,
                krw_per_usd: krwPerUsd,
                credits,
                gen_ms: 1500 + Math.floor(Math.random() * 6000),
                ok: 1,
                created_at: createdAt,
                output,
                kind: t.category,
            });
            seq++;
        }
    }
}

// ========================= posts (게시물) =========================

interface DocRow {
    id: string;
    program_id: string;
    title: string;
    author_id: string;
    author_name: string;
    data: string;
    created_at: number;
    updated_at: number;
}

function rowToPost(r: DocRow): Post {
    const parsed = JSON.parse(r.data) as { blocks: Block[] };
    return {
        id: r.id,
        programId: r.program_id,
        title: r.title,
        authorId: r.author_id,
        authorName: r.author_name,
        blocks: parsed.blocks ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function countComments(postId: string): number {
    const r = db
        .prepare("SELECT COUNT(*) AS n FROM post_comments WHERE post_id = ?")
        .get(postId) as { n: number };
    return r.n;
}

export function listPosts(programId?: string): PostSummary[] {
    const rows = (
        programId
            ? db
                  .prepare("SELECT * FROM posts WHERE program_id = ? ORDER BY updated_at DESC")
                  .all(programId)
            : db.prepare("SELECT * FROM posts ORDER BY updated_at DESC").all()
    ) as DocRow[];
    return rows.map((row) => {
        const parsed = JSON.parse(row.data) as { blocks: Block[] };
        return {
            id: row.id,
            programId: row.program_id,
            title: row.title,
            authorName: row.author_name,
            blockCount: parsed.blocks?.length ?? 0,
            commentCount: countComments(row.id),
            updatedAt: row.updated_at,
        };
    });
}

export function getPost(id: string): Post | null {
    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as
        | DocRow
        | undefined;
    return row ? rowToPost(row) : null;
}

export function createPost(input: {
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
}): Post {
    const now = Date.now();
    const post: Post = {
        id: crypto.randomUUID(),
        programId: input.programId,
        title: input.title.trim() || "새 게시물",
        authorId: input.authorId,
        authorName: input.authorName,
        blocks: [],
        createdAt: now,
        updatedAt: now,
    };
    return upsertPost(post);
}

export function upsertPost(post: Post): Post {
    const now = Date.now();
    const existing = db
        .prepare("SELECT created_at FROM posts WHERE id = ?")
        .get(post.id) as { created_at: number } | undefined;
    const createdAt = existing?.created_at ?? post.createdAt ?? now;
    const data = JSON.stringify({ blocks: post.blocks });
    db.prepare(
        `INSERT INTO posts (id, program_id, title, author_id, author_name, data, created_at, updated_at)
     VALUES (@id, @program_id, @title, @author_id, @author_name, @data, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       program_id = @program_id, title = @title, author_id = @author_id,
       author_name = @author_name, data = @data, updated_at = @updated_at`,
    ).run({
        id: post.id,
        program_id: post.programId,
        title: post.title,
        author_id: post.authorId,
        author_name: post.authorName,
        data,
        created_at: createdAt,
        updated_at: now,
    });
    return getPost(post.id)!;
}

export function deletePost(id: string): void {
    db.prepare("DELETE FROM post_comments WHERE post_id = ?").run(id);
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
}

// ========================= announcements (공지사항) =========================

function rowToAnnouncement(r: DocRow): Announcement {
    const parsed = JSON.parse(r.data) as { blocks: Block[] };
    return {
        id: r.id,
        programId: r.program_id,
        title: r.title,
        authorId: r.author_id,
        authorName: r.author_name,
        blocks: parsed.blocks ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export function listAnnouncements(programId?: string): AnnouncementSummary[] {
    const rows = (
        programId
            ? db
                  .prepare(
                      "SELECT * FROM announcements WHERE program_id = ? ORDER BY updated_at DESC",
                  )
                  .all(programId)
            : db.prepare("SELECT * FROM announcements ORDER BY updated_at DESC").all()
    ) as DocRow[];
    return rows.map((row) => {
        const parsed = JSON.parse(row.data) as { blocks: Block[] };
        return {
            id: row.id,
            programId: row.program_id,
            title: row.title,
            authorName: row.author_name,
            blockCount: parsed.blocks?.length ?? 0,
            updatedAt: row.updated_at,
        };
    });
}

export function getAnnouncement(id: string): Announcement | null {
    const row = db.prepare("SELECT * FROM announcements WHERE id = ?").get(id) as
        | DocRow
        | undefined;
    return row ? rowToAnnouncement(row) : null;
}

export function createAnnouncement(input: {
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
}): Announcement {
    const now = Date.now();
    const announcement: Announcement = {
        id: crypto.randomUUID(),
        programId: input.programId,
        title: input.title.trim() || "새 공지사항",
        authorId: input.authorId,
        authorName: input.authorName,
        blocks: [],
        createdAt: now,
        updatedAt: now,
    };
    return upsertAnnouncement(announcement);
}

export function upsertAnnouncement(a: Announcement): Announcement {
    const now = Date.now();
    const existing = db
        .prepare("SELECT created_at FROM announcements WHERE id = ?")
        .get(a.id) as { created_at: number } | undefined;
    const createdAt = existing?.created_at ?? a.createdAt ?? now;
    const data = JSON.stringify({ blocks: a.blocks });
    db.prepare(
        `INSERT INTO announcements (id, program_id, title, author_id, author_name, data, created_at, updated_at)
     VALUES (@id, @program_id, @title, @author_id, @author_name, @data, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       program_id = @program_id, title = @title, author_id = @author_id,
       author_name = @author_name, data = @data, updated_at = @updated_at`,
    ).run({
        id: a.id,
        program_id: a.programId,
        title: a.title,
        author_id: a.authorId,
        author_name: a.authorName,
        data,
        created_at: createdAt,
        updated_at: now,
    });
    return getAnnouncement(a.id)!;
}

export function deleteAnnouncement(id: string): void {
    db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
}

// ========================= drills (시험 · 연습) =========================

interface DrillRow {
    id: string;
    program_id: string;
    kind: string;
    provider: string;
    title: string;
    mission: string;
    author_id: string;
    author_name: string;
    created_at: number;
    updated_at: number;
}

// DB 행을 Drill 도메인 객체로 변환한다.
function rowToDrill(r: DrillRow): Drill {
    return {
        id: r.id,
        programId: r.program_id,
        kind: r.kind as DrillKind,
        provider: r.provider as LlmProvider,
        title: r.title,
        mission: r.mission,
        authorId: r.author_id,
        authorName: r.author_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

// 한 강좌의 드릴 목록을 최신순으로 반환한다.
export function listDrills(programId?: string): DrillSummary[] {
    const rows = (
        programId
            ? db
                  .prepare("SELECT * FROM drills WHERE program_id = ? ORDER BY updated_at DESC")
                  .all(programId)
            : db.prepare("SELECT * FROM drills ORDER BY updated_at DESC").all()
    ) as DrillRow[];
    return rows.map((r) => ({
        id: r.id,
        programId: r.program_id,
        kind: r.kind as DrillKind,
        provider: r.provider as LlmProvider,
        title: r.title,
        updatedAt: r.updated_at,
    }));
}

// id로 드릴 한 건을 조회한다. 없으면 null.
export function getDrill(id: string): Drill | null {
    const row = db.prepare("SELECT * FROM drills WHERE id = ?").get(id) as
        | DrillRow
        | undefined;
    return row ? rowToDrill(row) : null;
}

// 새 드릴(시험/연습)을 생성한다.
export function createDrill(input: {
    programId: string;
    kind: DrillKind;
    provider: LlmProvider;
    title: string;
    mission?: string;
    authorId: string;
    authorName: string;
}): Drill {
    const now = Date.now();
    const drill: Drill = {
        id: crypto.randomUUID(),
        programId: input.programId,
        kind: input.kind === "exam" ? "exam" : "practice",
        provider: input.provider,
        title: input.title.trim() || (input.kind === "exam" ? "새 시험" : "새 연습"),
        mission: input.mission?.trim() ?? "",
        authorId: input.authorId,
        authorName: input.authorName,
        createdAt: now,
        updatedAt: now,
    };
    return upsertDrill(drill);
}

// 드릴을 저장(있으면 갱신)한다.
export function upsertDrill(drill: Drill): Drill {
    const now = Date.now();
    const existing = db
        .prepare("SELECT created_at FROM drills WHERE id = ?")
        .get(drill.id) as { created_at: number } | undefined;
    const createdAt = existing?.created_at ?? drill.createdAt ?? now;
    db.prepare(
        `INSERT INTO drills (id, program_id, kind, provider, title, mission, author_id, author_name, created_at, updated_at)
     VALUES (@id, @program_id, @kind, @provider, @title, @mission, @author_id, @author_name, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       program_id = @program_id, kind = @kind, provider = @provider, title = @title,
       mission = @mission, author_id = @author_id, author_name = @author_name, updated_at = @updated_at`,
    ).run({
        id: drill.id,
        program_id: drill.programId,
        kind: drill.kind,
        provider: drill.provider,
        title: drill.title,
        mission: drill.mission,
        author_id: drill.authorId,
        author_name: drill.authorName,
        created_at: createdAt,
        updated_at: now,
    });
    return getDrill(drill.id)!;
}

// 드릴을 삭제한다.
export function deleteDrill(id: string): void {
    db.prepare("DELETE FROM drills WHERE id = ?").run(id);
}

// ========================= post comments (댓글 · 비밀댓글) =========================

interface CommentRow {
    id: string;
    post_id: string;
    parent_id: string;
    user_id: string;
    author_name: string;
    author_avatar: string;
    live_avatar?: string | null; // joined current avatar from users (read only)
    live_name?: string | null; // joined current display name from users (read only)
    role: string;
    text: string;
    secret: number;
    attachments: string;
    created_at: number;
}

// 댓글 행을 PostComment로 변환한다. 작성자의 현재 프로필(users를 user_id로 라이브
// 조인)을 우선 사용해 아바타·표시 이름 변경이 본인뿐 아니라 모두에게 반영되도록 한다.
// 매칭되는 계정이 없는 레거시 행은 작성 시점 스냅샷으로 폴백한다.
function rowToComment(r: CommentRow): PostComment {
    return {
        id: r.id,
        postId: r.post_id,
        parentId: r.parent_id ? r.parent_id : null,
        userId: r.user_id,
        authorName:
            r.live_name != null && r.live_name !== "" ? r.live_name : r.author_name,
        authorAvatar:
            r.live_avatar != null ? r.live_avatar : r.author_avatar ?? "",
        role: r.role as Role,
        text: r.text,
        secret: !!r.secret,
        attachments: r.attachments ? JSON.parse(r.attachments) : [],
        createdAt: r.created_at,
    };
}

/** 뷰어가 이 댓글(스레드 루트 기준)을 볼 수 있는지 판정한다. 비밀이 아니면 누구나
  *  보고, 비밀이면 작성자 본인이거나 강사일 때만 본다. 대댓글의 가시성은 호출부에서
  *  루트 댓글을 넘겨 판정한다(답글은 루트의 비밀 여부를 상속). */
function canSeeComment(
    c: PostComment,
    viewer?: { userId?: string; role?: Role },
): boolean {
    if (viewer?.role === "instructor") return true;
    if (!c.secret) return true;
    return !!viewer?.userId && c.userId === viewer.userId;
}

/** 단일 댓글을 조회한다(대댓글 권한 검증·삭제 cascade에 쓰임). 라이브 프로필을
  *  조인해 현재 아바타·표시 이름을 반영한다. 없으면 null. */
export function getComment(id: string): PostComment | null {
    const row = db
        .prepare(
            "SELECT pc.*, u.avatar AS live_avatar, u.name AS live_name FROM post_comments pc LEFT JOIN users u ON u.id = pc.user_id WHERE pc.id = ?",
        )
        .get(id) as CommentRow | undefined;
    return row ? rowToComment(row) : null;
}

/** List comments for a post (대댓글 포함). 최상위 댓글은 자신의 비밀 규칙으로,
  *  대댓글은 부모(루트) 댓글의 비밀 규칙을 상속해 가린다 — 비밀 스레드의 답글은
  *  루트 작성자와 강사에게만 보이고 다른 학생은 볼 수 없다. */
export function listComments(
    postId: string,
    viewer?: { userId?: string; role?: Role },
): PostComment[] {
    const rows = db
        .prepare(
            "SELECT pc.*, u.avatar AS live_avatar, u.name AS live_name FROM post_comments pc LEFT JOIN users u ON u.id = pc.user_id WHERE pc.post_id = ? ORDER BY pc.created_at ASC",
        )
        .all(postId) as CommentRow[];
    const all = rows.map(rowToComment);
    if (viewer?.role === "instructor") return all;
    const byId = new Map(all.map((c) => [c.id, c]));
    return all.filter((c) => {
        // 대댓글은 부모(루트) 댓글의 가시성을 따른다. 부모가 안 보이면 답글도 숨긴다.
        const root = c.parentId ? byId.get(c.parentId) : c;
        if (root && !canSeeComment(root, viewer)) return false;
        // 본인이 쓴 답글은 항상 보이게(방어적). 루트가 안 보이면 위에서 이미 걸러짐.
        return true;
    });
}

/** 뷰어가 주어진 댓글(이 속한 스레드)을 볼 수 있는지 — 대댓글 작성 권한 검증용.
  *  비밀 스레드에 권한 없는 학생이 답글을 끼워넣지 못하게 서버에서 막는다.
  *  댓글이 없으면 false. */
export function canViewComment(
    commentId: string,
    viewer?: { userId?: string; role?: Role },
): boolean {
    const c = getComment(commentId);
    if (!c) return false;
    const root = c.parentId ? getComment(c.parentId) : c;
    return !!root && canSeeComment(root, viewer);
}

/** 댓글 또는 대댓글을 추가한다. parentId가 주어지면 그 댓글이 속한 스레드의 루트에
  *  답글로 매단다(1단 중첩으로 평탄화). 답글은 루트의 비밀 여부를 상속하므로
  *  클라이언트가 보낸 secret 값은 무시한다. */
export function addComment(input: {
    postId: string;
    userId: string;
    authorName: string;
    authorAvatar?: string;
    role: Role;
    text: string;
    secret?: boolean;
    attachments?: ChatAttachment[];
    parentId?: string | null;
}): PostComment {
    // 대댓글이면 부모를 찾아 루트로 평탄화하고, 비밀 여부를 루트에서 상속한다.
    let parentId = "";
    let secret = input.secret ? 1 : 0;
    if (input.parentId) {
        const parent = getComment(input.parentId);
        if (parent) {
            const rootId = parent.parentId ?? parent.id;
            const root = parent.parentId ? getComment(rootId) : parent;
            parentId = rootId;
            secret = root?.secret ? 1 : 0;
        }
    }
    const row: CommentRow = {
        id: crypto.randomUUID(),
        post_id: input.postId,
        parent_id: parentId,
        user_id: input.userId,
        author_name: input.authorName,
        author_avatar: input.authorAvatar ?? "",
        role: input.role,
        text: input.text,
        secret,
        attachments: JSON.stringify(input.attachments ?? []),
        created_at: Date.now(),
    };
    db.prepare(
        `INSERT INTO post_comments (id, post_id, parent_id, user_id, author_name, author_avatar, role, text, secret, attachments, created_at)
     VALUES (@id, @post_id, @parent_id, @user_id, @author_name, @author_avatar, @role, @text, @secret, @attachments, @created_at)`,
    ).run(row);
    return rowToComment(row);
}

/** Delete a comment. When `requester` is given, only the author or an
 *  instructor may delete. 최상위 댓글을 지우면 거기에 달린 대댓글도 함께 지운다.
 *  Returns true on success. */
export function deleteComment(
    id: string,
    requester?: { userId?: string; role?: Role },
): boolean {
    const row = db.prepare("SELECT * FROM post_comments WHERE id = ?").get(id) as
        | CommentRow
        | undefined;
    if (!row) return false;
    if (requester) {
        const isOwner = !!requester.userId && row.user_id === requester.userId;
        const isInstructor = requester.role === "instructor";
        if (!isOwner && !isInstructor) return false;
    }
    // 최상위 댓글이면 자식 대댓글까지 cascade 삭제.
    db.prepare("DELETE FROM post_comments WHERE id = ? OR parent_id = ?").run(id, id);
    return true;
}
