const WEEKDAY_LABELS = Object.freeze(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);

function pad(n) {
    return String(n).padStart(2, '0');
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getNow() {
    return new Date();
}

function monthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getMonthLabel(date) {
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function normalizeYear(year) {
    const numericYear = Number(year);
    if (!Number.isInteger(numericYear)) {
        return NaN;
    }
    return String(year).length <= 2 ? 2000 + numericYear : numericYear;
}

function buildDate(day, month, year) {
    const d = Number(day);
    const m = Number(month);
    const y = normalizeYear(year);
    if (![d, m, y].every(Number.isInteger)) {
        return null;
    }

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return null;
    }
    return date;
}

function parseCompactDate(raw, now = getNow()) {
    const digits = String(raw ?? '').replace(/\s+/g, '');
    if (!/^\d+$/.test(digits)) {
        return null;
    }

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (digits.length <= 2) {
        return buildDate(digits, currentMonth, currentYear);
    }
    if (digits.length === 4) {
        return buildDate(digits.slice(0, 2), digits.slice(2, 4), currentYear);
    }
    if (digits.length === 6) {
        return buildDate(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6));
    }
    if (digits.length === 8) {
        if (/^(19|20)\d{6}$/.test(digits)) {
            const isoDate = buildDate(digits.slice(6, 8), digits.slice(4, 6), digits.slice(0, 4));
            if (isoDate) {
                return isoDate;
            }
        }
        return buildDate(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8));
    }

    return null;
}

function parseDate(str, now = getNow()) {
    if (!str) {
        return null;
    }

    const raw = String(str).trim();
    if (!raw) {
        return null;
    }

    const compactDate = parseCompactDate(raw, now);
    if (compactDate) {
        return compactDate;
    }

    const parts = raw.replace(/[.,]/g, '/').split(/[/-]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) {
        return null;
    }

    let day;
    let month;
    let year;

    if (parts.length === 3) {
        if (parts[0].length === 4) {
            [year, month, day] = parts;
        } else {
            [day, month, year] = parts;
        }
    } else if (parts.length === 2) {
        [day, month] = parts;
        year = now.getFullYear();
    } else if (parts.length === 1) {
        [day] = parts;
        month = now.getMonth() + 1;
        year = now.getFullYear();
    } else {
        return null;
    }

    return buildDate(day, month, year);
}

function formatDate(date) {
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatDateISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateInputValue(rawValue, now = getNow()) {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
        return { value: '', parsedDate: null };
    }

    const parsedDate = parseDate(raw, now);
    return {
        value: parsedDate ? formatDate(parsedDate) : raw,
        parsedDate
    };
}

function getCalendarDays(viewDate, selectedValue, now = getNow()) {
    const selectedDate = parseDate(selectedValue, now);
    const currentMonthStart = monthStart(viewDate);
    const weekDayIndex = (currentMonthStart.getDay() + 6) % 7;
    const gridStart = new Date(currentMonthStart);
    gridStart.setDate(currentMonthStart.getDate() - weekDayIndex);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return {
            key: formatDateISO(date),
            label: date.getDate(),
            date,
            inMonth: date.getMonth() === viewDate.getMonth(),
            isToday: isSameDay(date, now),
            isSelected: selectedDate ? isSameDay(date, selectedDate) : false
        };
    });
}

function buildTime(hour, minute = 0, second = 0, hasSeconds = false) {
    const h = Number(hour);
    const m = Number(minute);
    const s = Number(second);
    if (![h, m, s].every(Number.isInteger)) {
        return null;
    }
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
        return null;
    }
    return { h, m, s, hasSeconds };
}

function parseCompactTime(raw) {
    const digits = String(raw ?? '').replace(/\s+/g, '');
    if (!/^\d+$/.test(digits)) {
        return null;
    }

    if (digits.length <= 2) {
        return buildTime(digits, 0, 0, false);
    }
    if (digits.length === 3 || digits.length === 4) {
        return buildTime(digits.slice(0, -2), digits.slice(-2), 0, false);
    }
    if (digits.length === 5 || digits.length === 6) {
        return buildTime(digits.slice(0, -4), digits.slice(-4, -2), digits.slice(-2), true);
    }

    return null;
}

function parseTime(str) {
    if (!str) {
        return null;
    }

    const raw = String(str).trim();
    if (!raw) {
        return null;
    }

    const compactTime = parseCompactTime(raw);
    if (compactTime) {
        return compactTime;
    }

    const parts = raw.replace(/[.,]/g, ':').split(':').map((part) => part.trim()).filter(Boolean);
    if (!parts.length || parts.length > 3) {
        return null;
    }

    return buildTime(parts[0], parts[1] ?? 0, parts[2] ?? 0, parts.length === 3);
}

function formatTime(timeValue, options = {}) {
    const includeSeconds = options.includeSeconds ?? Boolean(timeValue.hasSeconds);
    const base = `${pad(timeValue.h)}:${pad(timeValue.m)}`;
    return includeSeconds ? `${base}:${pad(timeValue.s ?? 0)}` : base;
}

function normalizeTimeInputValue(rawValue) {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
        return { value: '', parsedTime: null };
    }

    const parsedTime = parseTime(raw);
    return {
        value: parsedTime ? formatTime(parsedTime, { includeSeconds: parsedTime.hasSeconds }) : raw,
        parsedTime
    };
}

function normalizeTimePart(rawValue, max) {
    const digits = String(rawValue ?? '').replace(/\D+/g, '').slice(0, 2);
    if (!digits) {
        return '';
    }
    return pad(clamp(Number(digits), 0, max));
}

function pickerStateFromTime(parsedTime, now = getNow()) {
    if (parsedTime) {
        return {
            pickerHour: pad(parsedTime.h),
            pickerMinute: pad(parsedTime.m),
            pickerSecond: pad(parsedTime.s ?? 0),
            pickerHasSeconds: Boolean(parsedTime.hasSeconds)
        };
    }

    return {
        pickerHour: pad(now.getHours()),
        pickerMinute: pad(now.getMinutes()),
        pickerSecond: '00',
        pickerHasSeconds: false
    };
}

function splitDateTimeValue(str) {
    const raw = String(str || '').trim();
    if (!raw) {
        return { datePart: '', timePart: '' };
    }

    if (raw.includes('T')) {
        const [datePart, timePart = ''] = raw.split('T');
        return { datePart: datePart.trim(), timePart: timePart.trim() };
    }

    const parts = raw.split(/\s+/);
    if (parts.length === 1) {
        return { datePart: parts[0], timePart: '' };
    }

    const [datePart, ...rest] = parts;
    return { datePart: datePart.trim(), timePart: rest.join(' ').trim() };
}

export {
    WEEKDAY_LABELS,
    formatDate,
    formatDateISO,
    formatTime,
    getCalendarDays,
    getMonthLabel,
    getNow,
    isSameDay,
    monthStart,
    normalizeDateInputValue,
    normalizeTimeInputValue,
    normalizeTimePart,
    pad,
    parseDate,
    parseTime,
    pickerStateFromTime,
    shiftMonth,
    splitDateTimeValue
};
