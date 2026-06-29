/**
 * 강좌 수업 일정 입력 필드 묶음 — 시작일·종료일·수업 요일을 입력받고 1주차 수업
 * 날짜를 실시간 미리보기로 보여주는 제어(controlled) 컴포넌트. 강좌 생성·수정
 * 다이얼로그가 공유한다. 날짜 선택은 shadcn/ui Calendar(달력 팝오버)를 쓴다.
 */
"use client";

import * as React from "react";
import { ko } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import {
    firstWeekSessions,
    formatKoreanDate,
    formatLocalDate,
    parseLocalDate,
    WEEKDAY_LABELS,
    WEEKDAY_ORDER,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface ScheduleFieldsProps {
    startDate: string;
    endDate: string;
    weekDays: number[];
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onWeekDaysChange: (next: number[]) => void;
    disabled?: boolean;
    /** label htmlFor / input id 충돌 방지용 접두어 (생성: "create", 수정: "edit" 등). */
    idPrefix: string;
}

// 달력 팝오버로 "YYYY-MM-DD" 날짜 하나를 고르는 입력칸 — 시작일·종료일이 공유한다.
function DatePickerField({
    id,
    value,
    onChange,
    minDate,
    disabled,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    minDate?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const selected = parseLocalDate(value) ?? undefined;
    const min = minDate ? parseLocalDate(minDate) ?? undefined : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "h-8 w-full justify-start gap-2 px-2.5 font-normal",
                            !selected && "text-muted-foreground",
                        )}
                    >
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        {selected ? formatKoreanDate(value) : "날짜 선택"}
                    </Button>
                }
            />
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    locale={ko}
                    selected={selected}
                    defaultMonth={selected ?? min}
                    disabled={min ? { before: min } : undefined}
                    onSelect={(date) => {
                        if (date) onChange(formatLocalDate(date));
                        setOpen(false);
                    }}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}

export function ScheduleFields({
    startDate,
    endDate,
    weekDays,
    onStartDateChange,
    onEndDateChange,
    onWeekDaysChange,
    disabled = false,
    idPrefix,
}: ScheduleFieldsProps) {
    // 요일 버튼 토글 — 이미 선택돼 있으면 빼고, 아니면 추가해 정렬된 배열로 올린다.
    function toggleWeekDay(day: number) {
        const next = weekDays.includes(day)
            ? weekDays.filter((d) => d !== day)
            : [...weekDays, day].sort((a, b) => a - b);
        onWeekDaysChange(next);
    }

    // 선택한 시작일·요일로 1주차에 수업하는 날짜를 계산한다(실시간 미리보기).
    const firstWeek = firstWeekSessions(startDate || null, weekDays, endDate || null);

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-start`}>시작일</Label>
                    <DatePickerField
                        id={`${idPrefix}-start`}
                        value={startDate}
                        onChange={onStartDateChange}
                        disabled={disabled}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-end`}>종료일</Label>
                    <DatePickerField
                        id={`${idPrefix}-end`}
                        value={endDate}
                        onChange={onEndDateChange}
                        minDate={startDate || undefined}
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>수업 요일</Label>
                <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_ORDER.map((day) => (
                        <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant={weekDays.includes(day) ? "default" : "outline"}
                            className="w-9"
                            disabled={disabled}
                            onClick={() => toggleWeekDay(day)}
                        >
                            {WEEKDAY_LABELS[day]}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
                <span className="text-sm font-medium">1주차 수업일</span>
                {!startDate ? (
                    <span className="text-sm text-muted-foreground">
                        시작일을 선택하면 1주차 수업 날짜가 표시됩니다.
                    </span>
                ) : weekDays.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                        수업 요일을 한 개 이상 선택하세요.
                    </span>
                ) : firstWeek.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                        1주차에 해당하는 수업일이 없습니다.
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {firstWeek.map((s) => (
                            <span
                                key={s.date}
                                className="rounded-md bg-background px-2 py-1 text-sm shadow-sm"
                            >
                                {formatKoreanDate(s.date)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
