import {
    Type,
    Heading,
    Image as ImageIcon,
    PenLine,
    Video,
    Music,
    Quote,
    Lightbulb,
    Minus,
    Table,
    ChartColumn,
    WandSparkles,
    Bot,
    Upload,
    Link,
    type LucideIcon,
} from "lucide-react";
import type { BlockType } from "@/lib/types";

const MAP: Record<BlockType, LucideIcon> = {
    text: Type,
    heading: Heading,
    image: ImageIcon,
    llm: PenLine,
    video: Video,
    audio: Music,
    quote: Quote,
    callout: Lightbulb,
    divider: Minus,
    table: Table,
    chart: ChartColumn,
    bookmark: Link,
};

/** lucide 아이콘 이름 → 컴포넌트. BLOCK_META.icon 문자열을 그릴 때 쓴다(생성=✨, 업로드=⬆ 구분 포함). */
const NAME_MAP: Record<string, LucideIcon> = {
    Type,
    Heading,
    Image: ImageIcon,
    PenLine,
    Video,
    Music,
    Quote,
    Lightbulb,
    Minus,
    Table,
    ChartColumn,
    WandSparkles,
    Bot,
    Upload,
    Link,
};

export function blockIcon(type: BlockType): LucideIcon {
    return MAP[type];
}

export function BlockIcon({
    type,
    className,
}: {
    type: BlockType;
    className?: string;
}) {
    const Icon = MAP[type];
    return <Icon className={className} />;
}

/** BLOCK_META.icon(문자열)으로 아이콘을 그린다. 팔레트·슬래시·드래그 오버레이에서 사용. */
export function MetaIcon({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    const Icon = NAME_MAP[name] ?? Type;
    return <Icon className={className} />;
}
