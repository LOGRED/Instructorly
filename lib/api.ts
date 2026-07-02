// Client-side API helpers. Thin wrappers over the route handlers.
import type {
    Course,
    CourseSummary,
    ChatMessage,
    ChatAttachment,
    Role,
    UserPublic,
    Program,
    ProgramSummary,
    Enrollment,
    LessonProgress,
    StudentBlockWork,
    BlockRun,
    Post,
    PostSummary,
    Announcement,
    AnnouncementSummary,
    PostComment,
    Drill,
    DrillSummary,
    DrillKind,
    LlmProvider,
    Atelier,
    AtelierSummary,
    AtelierWork,
    AtelierDoc,
    AtelierGenre,
    StudioCatalog,
    StudioCategory,
    StudioGenResult,
    UsageRecord,
} from "./types";
import type { PageGen } from "./course-schema";

async function unwrap<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `요청 실패 (${res.status})`);
    }
    return res.json() as Promise<T>;
}

export async function listCourses(): Promise<CourseSummary[]> {
    const data = await unwrap<{ courses: CourseSummary[] }>(
        await fetch("/api/courses", { cache: "no-store" }),
    );
    return data.courses;
}

export async function getCourse(id: string): Promise<Course> {
    const data = await unwrap<{ course: Course }>(
        await fetch(`/api/courses/${id}`, { cache: "no-store" }),
    );
    return data.course;
}

export async function createCourse(input: {
    title: string;
    description?: string;
    authorNickname?: string;
}): Promise<Course> {
    const data = await unwrap<{ course: Course }>(
        await fetch("/api/courses", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.course;
}

export async function saveCourse(course: Course): Promise<Course> {
    const data = await unwrap<{ course: Course }>(
        await fetch(`/api/courses/${course.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(course),
        }),
    );
    return data.course;
}

export async function deleteCourse(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/courses/${id}`, { method: "DELETE" }),
    );
}

export interface ImageGenResult {
    dataUrl: string;
    genMs: number;
    seed: number;
}

export async function generateImage(
    prompt: string,
    seed?: number,
): Promise<ImageGenResult> {
    return unwrap<ImageGenResult>(
        await fetch("/api/generate/image", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt, seed }),
        }),
    );
}

export interface TextGenResult {
    output: string;
    genMs: number;
}

export async function generateText(prompt: string): Promise<TextGenResult> {
    return unwrap<TextGenResult>(
        await fetch("/api/generate/text", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
        }),
    );
}

export interface MediaGenResult {
    url: string;
    genMs: number;
}

// 프롬프트로 동영상을 생성한다(프로토타입: 서버가 샘플 클립을 반환).
export async function generateVideo(prompt: string): Promise<MediaGenResult> {
    return unwrap<MediaGenResult>(
        await fetch("/api/generate/video", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
        }),
    );
}

// 프롬프트로 오디오를 생성한다(서버가 WAV를 합성해 data URL로 반환).
export async function generateAudio(prompt: string): Promise<MediaGenResult> {
    return unwrap<MediaGenResult>(
        await fetch("/api/generate/audio", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
        }),
    );
}

/** 링크 미리보기(Open Graph 메타) 결과 — 북마크 블럭 카드용. */
export interface LinkPreview {
    url: string;
    title: string;
    description: string;
    image: string | null;
    favicon: string | null;
    siteName: string;
}

/** URL의 Open Graph 메타를 서버에서 긁어 북마크 카드용 정보로 가져온다. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
    return unwrap<LinkPreview>(
        await fetch("/api/link/preview", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
        }),
    );
}

export async function uploadFile(file: File): Promise<ChatAttachment> {
    const form = new FormData();
    form.append("file", file);
    return unwrap<ChatAttachment>(
        await fetch("/api/upload", { method: "POST", body: form }),
    );
}

export async function getChat(
    courseId: string,
    since = 0,
): Promise<{ messages: ChatMessage[]; serverTime: number }> {
    return unwrap<{ messages: ChatMessage[]; serverTime: number }>(
        await fetch(`/api/courses/${courseId}/chat?since=${since}`, {
            cache: "no-store",
        }),
    );
}

export async function postChat(
    courseId: string,
    msg: {
        nickname: string;
        role: Role;
        userId?: string;
        avatar?: string;
        text: string;
        attachments: ChatAttachment[];
    },
): Promise<ChatMessage> {
    const data = await unwrap<{ message: ChatMessage }>(
        await fetch(`/api/courses/${courseId}/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(msg),
        }),
    );
    return data.message;
}

/** 말풍선 이모지 반응을 토글한다(누르면 추가, 다시 누르면 취소). 갱신된 메시지를 반환한다. */
export async function reactToMessage(
    courseId: string,
    messageId: string,
    userId: string,
    emoji: string,
): Promise<ChatMessage> {
    const data = await unwrap<{ message: ChatMessage }>(
        await fetch(`/api/courses/${courseId}/chat`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId, userId, emoji }),
        }),
    );
    return data.message;
}

// ---------- auth ----------

export async function register(input: {
    id: string;
    password: string;
    name: string;
    role: Role;
}): Promise<UserPublic> {
    const data = await unwrap<{ user: UserPublic }>(
        await fetch("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.user;
}

export async function login(input: {
    id: string;
    password: string;
}): Promise<UserPublic> {
    const data = await unwrap<{ user: UserPublic }>(
        await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.user;
}

/** Type-ahead user search (instructor enrollment). */
export async function searchUsers(
    q: string,
    role?: Role,
): Promise<UserPublic[]> {
    const params = new URLSearchParams({ q });
    if (role) params.set("role", role);
    const data = await unwrap<{ users: UserPublic[] }>(
        await fetch(`/api/users/search?${params.toString()}`, {
            cache: "no-store",
        }),
    );
    return data.users;
}

/** Update the signed-in user's display name and/or avatar. */
export async function updateProfile(input: {
    userId: string;
    name?: string;
    avatar?: string;
}): Promise<UserPublic> {
    const data = await unwrap<{ user: UserPublic }>(
        await fetch("/api/profile", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.user;
}

// ---------- programs (강좌) ----------

export async function listPrograms(params: {
    ownerId?: string;
    userId?: string;
    role?: Role;
}): Promise<ProgramSummary[]> {
    const q = new URLSearchParams();
    if (params.role) q.set("role", params.role);
    if (params.ownerId) q.set("ownerId", params.ownerId);
    if (params.userId) q.set("userId", params.userId);
    const data = await unwrap<{ programs: ProgramSummary[] }>(
        await fetch(`/api/programs?${q.toString()}`, { cache: "no-store" }),
    );
    return data.programs;
}

export async function getProgram(id: string): Promise<Program> {
    const data = await unwrap<{ program: Program }>(
        await fetch(`/api/programs/${id}`, { cache: "no-store" }),
    );
    return data.program;
}

export async function createProgram(input: {
    title: string;
    description?: string;
    ownerId: string;
    ownerName: string;
    startDate?: string | null;
    endDate?: string | null;
    weekDays?: number[];
}): Promise<Program> {
    const data = await unwrap<{ program: Program }>(
        await fetch("/api/programs", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.program;
}

export async function saveProgram(program: Program): Promise<Program> {
    const data = await unwrap<{ program: Program }>(
        await fetch(`/api/programs/${program.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(program),
        }),
    );
    return data.program;
}

/** Partial update of program metadata (title/description). The PUT route
  *  merges over the existing program, so weeks/roster stay untouched. */
export async function updateProgram(
    id: string,
    patch: {
        title?: string;
        description?: string;
        startDate?: string | null;
        endDate?: string | null;
        weekDays?: number[];
    },
): Promise<Program> {
    const data = await unwrap<{ program: Program }>(
        await fetch(`/api/programs/${id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
        }),
    );
    return data.program;
}

export async function deleteProgram(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/programs/${id}`, { method: "DELETE" }),
    );
}

// ---------- enrollment ----------

export async function getRoster(
    programId: string,
): Promise<{ enrollments: Enrollment[]; progress: LessonProgress[] }> {
    return unwrap<{ enrollments: Enrollment[]; progress: LessonProgress[] }>(
        await fetch(`/api/programs/${programId}/enroll`, { cache: "no-store" }),
    );
}

export async function enrollStudents(
    programId: string,
    userIds: string[],
): Promise<{ enrolled: Enrollment[]; failed: string[] }> {
    return unwrap<{ enrolled: Enrollment[]; failed: string[] }>(
        await fetch(`/api/programs/${programId}/enroll`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userIds }),
        }),
    );
}

export async function unenrollStudent(
    programId: string,
    userId: string,
): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/programs/${programId}/enroll`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId }),
        }),
    );
}

export async function joinByInvite(
    code: string,
    userId: string,
): Promise<Program> {
    const data = await unwrap<{ program: Program }>(
        await fetch("/api/programs/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, userId }),
        }),
    );
    return data.program;
}

// ---------- progress ----------

export async function recordProgress(input: {
    userId: string;
    lessonId: string;
    programId?: string;
    page: number;
    totalPages: number;
}): Promise<LessonProgress> {
    const data = await unwrap<{ progress: LessonProgress }>(
        await fetch("/api/progress", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.progress;
}

export async function getStudentProgress(
    userId: string,
    programId?: string,
): Promise<LessonProgress[]> {
    const q = new URLSearchParams({ userId });
    if (programId) q.set("programId", programId);
    const data = await unwrap<{ progress: LessonProgress[] }>(
        await fetch(`/api/progress?${q.toString()}`, { cache: "no-store" }),
    );
    return data.progress;
}

export async function getProgramProgress(
    programId: string,
): Promise<LessonProgress[]> {
    const data = await unwrap<{ progress: LessonProgress[] }>(
        await fetch(`/api/progress?programId=${encodeURIComponent(programId)}`, {
            cache: "no-store",
        }),
    );
    return data.progress;
}

// ---------- student block work ----------

export async function getMyWork(
    userId: string,
    lessonId: string,
): Promise<StudentBlockWork[]> {
    const q = new URLSearchParams({ userId, lessonId });
    const data = await unwrap<{ work: StudentBlockWork[] }>(
        await fetch(`/api/work?${q.toString()}`, { cache: "no-store" }),
    );
    return data.work;
}

/** 한 학생이 모든 강의에서 만든 작품 전체(최신순) — 자랑방 작품 보관함. */
export async function getAllMyWork(
    userId: string,
): Promise<StudentBlockWork[]> {
    const q = new URLSearchParams({ userId });
    const data = await unwrap<{ work: StudentBlockWork[] }>(
        await fetch(`/api/work?${q.toString()}`, { cache: "no-store" }),
    );
    return data.work;
}

/** Instructor: all students' work for a lesson. */
export async function getLessonWork(
    lessonId: string,
): Promise<StudentBlockWork[]> {
    const q = new URLSearchParams({ lessonId });
    const data = await unwrap<{ work: StudentBlockWork[] }>(
        await fetch(`/api/work?${q.toString()}`, { cache: "no-store" }),
    );
    return data.work;
}

export async function saveBlockWork(input: {
    userId: string;
    lessonId: string;
    blockId: string;
    blockType: "image" | "video" | "audio" | "llm";
    run: BlockRun;
    appendHistory?: boolean;
}): Promise<StudentBlockWork> {
    const data = await unwrap<{ work: StudentBlockWork }>(
        await fetch("/api/work", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.work;
}

// ---------- posts (게시물) ----------

export async function listPosts(programId?: string): Promise<PostSummary[]> {
    const q = programId ? `?programId=${encodeURIComponent(programId)}` : "";
    const data = await unwrap<{ posts: PostSummary[] }>(
        await fetch(`/api/posts${q}`, { cache: "no-store" }),
    );
    return data.posts;
}

export async function getPost(id: string): Promise<Post> {
    const data = await unwrap<{ post: Post }>(
        await fetch(`/api/posts/${id}`, { cache: "no-store" }),
    );
    return data.post;
}

export async function createPost(input: {
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
}): Promise<Post> {
    const data = await unwrap<{ post: Post }>(
        await fetch("/api/posts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.post;
}

export async function savePost(post: Post): Promise<Post> {
    const data = await unwrap<{ post: Post }>(
        await fetch(`/api/posts/${post.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(post),
        }),
    );
    return data.post;
}

export async function deletePost(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/posts/${id}`, { method: "DELETE" }),
    );
}

// ---------- announcements (공지사항) ----------

export async function listAnnouncements(
    programId?: string,
): Promise<AnnouncementSummary[]> {
    const q = programId ? `?programId=${encodeURIComponent(programId)}` : "";
    const data = await unwrap<{ announcements: AnnouncementSummary[] }>(
        await fetch(`/api/announcements${q}`, { cache: "no-store" }),
    );
    return data.announcements;
}

export async function getAnnouncement(id: string): Promise<Announcement> {
    const data = await unwrap<{ announcement: Announcement }>(
        await fetch(`/api/announcements/${id}`, { cache: "no-store" }),
    );
    return data.announcement;
}

export async function createAnnouncement(input: {
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
}): Promise<Announcement> {
    const data = await unwrap<{ announcement: Announcement }>(
        await fetch("/api/announcements", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.announcement;
}

export async function saveAnnouncement(a: Announcement): Promise<Announcement> {
    const data = await unwrap<{ announcement: Announcement }>(
        await fetch(`/api/announcements/${a.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(a),
        }),
    );
    return data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/announcements/${id}`, { method: "DELETE" }),
    );
}

// ---------- post comments (댓글 · 비밀댓글) ----------

/** Fetch comments for a post. The viewer's id+role decide which secret comments
 *  are returned (author or instructor only). */
export async function getComments(
    postId: string,
    viewer?: { userId?: string | null; role?: Role | null },
): Promise<PostComment[]> {
    const q = new URLSearchParams();
    if (viewer?.userId) q.set("userId", viewer.userId);
    if (viewer?.role) q.set("role", viewer.role);
    const qs = q.toString();
    const data = await unwrap<{ comments: PostComment[] }>(
        await fetch(`/api/posts/${postId}/comments${qs ? `?${qs}` : ""}`, {
            cache: "no-store",
        }),
    );
    return data.comments;
}

export async function addComment(input: {
    postId: string;
    userId: string;
    authorName: string;
    authorAvatar?: string;
    role: Role;
    text: string;
    secret?: boolean;
    /** 댓글 첨부(채팅과 동일 규격). 없으면 생략. */
    attachments?: ChatAttachment[];
    /** 대댓글이면 부모 댓글 id. 서버가 스레드 루트로 평탄화하고 비밀 여부를 상속한다. */
    parentId?: string | null;
}): Promise<PostComment> {
    const { postId, ...body } = input;
    const data = await unwrap<{ comment: PostComment }>(
        await fetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );
    return data.comment;
}

export async function deleteComment(
    postId: string,
    commentId: string,
    requester?: { userId?: string | null; role?: Role | null },
): Promise<void> {
    const q = new URLSearchParams({ commentId });
    if (requester?.userId) q.set("userId", requester.userId);
    if (requester?.role) q.set("role", requester.role);
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/posts/${postId}/comments?${q.toString()}`, {
            method: "DELETE",
        }),
    );
}

// ---------- drills (시험 · 연습) ----------

// 한 강좌의 시험·연습 목록을 가져온다.
export async function listDrills(programId?: string): Promise<DrillSummary[]> {
    const q = programId ? `?programId=${encodeURIComponent(programId)}` : "";
    const data = await unwrap<{ drills: DrillSummary[] }>(
        await fetch(`/api/drills${q}`, { cache: "no-store" }),
    );
    return data.drills;
}

// 드릴 한 건을 가져온다.
export async function getDrill(id: string): Promise<Drill> {
    const data = await unwrap<{ drill: Drill }>(
        await fetch(`/api/drills/${id}`, { cache: "no-store" }),
    );
    return data.drill;
}

// 새 시험/연습을 생성한다.
export async function createDrill(input: {
    programId: string;
    kind: DrillKind;
    provider: LlmProvider;
    title: string;
    mission?: string;
    authorId: string;
    authorName: string;
}): Promise<Drill> {
    const data = await unwrap<{ drill: Drill }>(
        await fetch("/api/drills", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.drill;
}

// 드릴을 저장(수정)한다.
export async function saveDrill(drill: Drill): Promise<Drill> {
    const data = await unwrap<{ drill: Drill }>(
        await fetch(`/api/drills/${drill.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(drill),
        }),
    );
    return data.drill;
}

// 드릴을 삭제한다.
export async function deleteDrill(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/drills/${id}`, { method: "DELETE" }),
    );
}

// ---------- ateliers (창작 실습) ----------

// 한 강좌의 창작 실습 목록을 가져온다.
export async function listAteliers(programId?: string): Promise<AtelierSummary[]> {
    const q = programId ? `?programId=${encodeURIComponent(programId)}` : "";
    const data = await unwrap<{ ateliers: AtelierSummary[] }>(
        await fetch(`/api/ateliers${q}`, { cache: "no-store" }),
    );
    return data.ateliers;
}

// 창작 실습 한 건(강사 시범본 포함)을 가져온다.
export async function getAtelier(id: string): Promise<Atelier> {
    const data = await unwrap<{ atelier: Atelier }>(
        await fetch(`/api/ateliers/${id}`, { cache: "no-store" }),
    );
    return data.atelier;
}

// 새 창작 실습을 생성한다(장르·템플릿 선택).
export async function createAtelier(input: {
    programId: string;
    genre: AtelierGenre;
    templateId?: string;
    title: string;
    brief?: string;
    authorId: string;
    authorName: string;
}): Promise<Atelier> {
    const data = await unwrap<{ atelier: Atelier }>(
        await fetch("/api/ateliers", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
    return data.atelier;
}

// 창작 실습(강사 시범본 등)을 저장한다.
export async function saveAtelier(atelier: Atelier): Promise<Atelier> {
    const data = await unwrap<{ atelier: Atelier }>(
        await fetch(`/api/ateliers/${atelier.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(atelier),
        }),
    );
    return data.atelier;
}

// 창작 실습을 삭제한다(학생 작품까지 함께 삭제).
export async function deleteAtelier(id: string): Promise<void> {
    await unwrap<{ ok: boolean }>(
        await fetch(`/api/ateliers/${id}`, { method: "DELETE" }),
    );
}

// 한 학생의 작품을 가져온다(없으면 null).
export async function getAtelierWork(
    atelierId: string,
    userId: string,
): Promise<AtelierWork | null> {
    const q = new URLSearchParams({ userId });
    const data = await unwrap<{ work: AtelierWork | null }>(
        await fetch(`/api/ateliers/${atelierId}/work?${q.toString()}`, { cache: "no-store" }),
    );
    return data.work;
}

// 한 창작 실습의 모든 학생 작품을 가져온다(강사 리뷰용).
export async function listAtelierWorks(atelierId: string): Promise<AtelierWork[]> {
    const data = await unwrap<{ works: AtelierWork[] }>(
        await fetch(`/api/ateliers/${atelierId}/work?all=1`, { cache: "no-store" }),
    );
    return data.works;
}

// 학생 작품을 저장(있으면 갱신)한다.
export async function saveAtelierWork(input: {
    atelierId: string;
    userId: string;
    userName: string;
    doc: AtelierDoc;
}): Promise<AtelierWork> {
    const { atelierId, ...body } = input;
    const data = await unwrap<{ work: AtelierWork }>(
        await fetch(`/api/ateliers/${atelierId}/work`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );
    return data.work;
}

// ---------- AI 스튜디오 (OpenRouter · 크레딧) ----------

/** 모델 카탈로그(라이브 단가·크레딧 환산)와 실시간 환율, 키 보유 여부를 가져온다. */
export async function getStudioCatalog(): Promise<StudioCatalog> {
    return unwrap<StudioCatalog>(
        await fetch("/api/studio/models", { cache: "no-store" }),
    );
}

/** 한 번의 생성을 요청한다(텍스트/이미지/동영상/오디오). 결과에 크레딧 비용이 들어온다. */
export async function studioGenerate(input: {
    category: StudioCategory;
    model: string;
    modelLabel: string;
    prompt: string;
    userId?: string;
    userName?: string;
    system?: string;
    voice?: string;
    resolution?: string;
    aspectRatio?: string;
}): Promise<StudioGenResult> {
    return unwrap<StudioGenResult>(
        await fetch("/api/studio/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
}

/** 페이지 생성 채팅 응답 — AI 답변 + 선택적 "현재 페이지" 본문 + 크레딧 비용. */
export interface PageGenReply {
    reply: string;
    /** AI가 만든 페이지 본문(없으면 null). 적용은 docToPage로 변환해서 한다. */
    page: PageGen | null;
    model: string;
    modelLabel: string;
    credits: number;
    krw: number;
    costUsd: number;
    genMs: number;
    free: boolean;
}

/** 대화로 "현재 페이지"를 생성/수정한다. messages는 user/assistant 발화 이력. */
export async function generatePage(input: {
    messages: { role: "user" | "assistant"; content: string }[];
    currentPage?: { title: string; blocks: unknown[] } | null;
    courseTitle?: string;
    model?: string;
    modelLabel?: string;
    userId?: string;
    userName?: string;
}): Promise<PageGenReply> {
    return unwrap<PageGenReply>(
        await fetch("/api/studio/course", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
}

/** 내(본인) 생성 기록만 가져온다(결과물 본문 제외, 가벼운 목록). */
export async function getMyUsage(userId: string): Promise<{ records: UsageRecord[] }> {
    return unwrap<{ records: UsageRecord[] }>(
        await fetch(`/api/studio/usage?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
        }),
    );
}

/** 내 기록 하나의 결과물 본문(텍스트/이미지/동영상/오디오)까지 단건 상세 조회한다. */
export async function getUsageRecord(id: string, userId: string): Promise<UsageRecord> {
    const q = new URLSearchParams({ id, userId });
    const data = await unwrap<{ record: UsageRecord }>(
        await fetch(`/api/studio/usage/record?${q.toString()}`, { cache: "no-store" }),
    );
    return data.record;
}
