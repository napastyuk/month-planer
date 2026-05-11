const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTHS_SHORT_GENITIVE = [
    "янв.",
    "фев.",
    "мар.",
    "апр.",
    "мая",
    "июн.",
    "июл.",
    "авг.",
    "сент.",
    "окт.",
    "нояб.",
    "дек.",
];

const HOLIDAYS_URL =
    "https://raw.githubusercontent.com/d10xa/holidays-calendar/refs/heads/master/json/calendar.json";

/* =========================================================
   HELPERS
========================================================= */

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (text !== "") {
        node.textContent = text;
    }

    return node;
}

function normalizeDate(date) {
    const copy = new Date(date);

    copy.setHours(0, 0, 0, 0);

    return copy;
}

function addDays(date, delta) {
    const copy = new Date(date);

    copy.setDate(copy.getDate() + delta);

    return copy;
}

function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function startOfWeekMonday(date) {
    const copy = normalizeDate(date);

    const offset = (copy.getDay() + 6) % 7;

    copy.setDate(copy.getDate() - offset);

    return copy;
}

function dateToISO(date) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function capitalizeFirst(text) {
    if (!text) return text;

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthTitle(date) {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
        month: "long",
        year: "numeric",
    }).format(date);

    return capitalizeFirst(formatted.replace(/\s*г\.?$/u, ""));
}

function shortWeekday(date) {
    return WEEKDAY_LABELS[(date.getDay() + 6) % 7];
}

function formatWeekRange(start) {
    const end = addDays(start, 6);

    const sameMonth =
        start.getMonth() === end.getMonth() &&
        start.getFullYear() === end.getFullYear();

    if (sameMonth) {
        return `${start.getDate()}–${end.getDate()} ${
            MONTHS_SHORT_GENITIVE[start.getMonth()]
        }`;
    }

    return `${start.getDate()} ${
        MONTHS_SHORT_GENITIVE[start.getMonth()]
    } — ${end.getDate()} ${MONTHS_SHORT_GENITIVE[end.getMonth()]}`;
}

/* =========================================================
   HOLIDAYS
========================================================= */

async function loadHolidayMap() {
    const response = await fetch(HOLIDAYS_URL);

    if (!response.ok) {
        throw new Error(
            `Не удалось загрузить holidays json: ${response.status}`,
        );
    }

    const data = await response.json();

    /*
    
    holidays - выходные и праздничные дни
    preholidays - предпраздничные дни, в которые продолжительность работы сокращается на один час
    nowork - внезапные нерабочие дни в соответствии с Указом Президента

    Формат response:
    {
      "holidays": [ 
        "2017-01-01",
        "2017-12-31"
      ],
      "preholidays": [
        "2017-02-22"
      ],
      "nowork": [
        "2020-03-30"
      ]
    }
  */

    const map = new Map();

    /* ---------- HOLIDAYS ---------- */

    if (Array.isArray(data.holidays)) {
        data.holidays.forEach((date) => {
            map.set(date, {type: "holiday"});
        });
    }

    /* ---------- PREHOLIDAYS ---------- */

    if (Array.isArray(data.preholidays)) {
        data.preholidays.forEach((date) => {
            map.set(date, { type: "preholiday"});
        });
    }

    /* ---------- NOWORK ---------- */

    if (Array.isArray(data.nowork)) {
        data.nowork.forEach((date) => {
            map.set(date, { type: "nowork"});
        });
    }

    return map;
}

/* =========================================================
   CALENDAR MATRIX
========================================================= */

function getMonthMatrix(year, month, holidayMap) {
    const firstOfMonth = new Date(year, month, 1);

    const start = startOfWeekMonday(firstOfMonth);

    const weeks = [];

    for (let week = 0; week < 6; week += 1) {
        const row = [];

        for (let day = 0; day < 7; day += 1) {
            const date = addDays(start, week * 7 + day);

            const iso = dateToISO(date);

            row.push({
                date,
                iso,

                inMonth:
                    date.getMonth() === month && date.getFullYear() === year,

                isHoliday: holidayMap.has(iso),
            });
        }

        weeks.push(row);
    }

    return weeks;
}

/* =========================================================
   LINES
========================================================= */

function makeLineSet(count, className) {
    const wrap = el("div", className);

    for (let i = 0; i < count; i += 1) {
        wrap.appendChild(el("span", "line"));
    }

    return wrap;
}

/* =========================================================
   DAY CARD
========================================================= */

function renderDayCard(date, baseDate) {
    const inBaseMonth =
        date.getMonth() === baseDate.getMonth() &&
        date.getFullYear() === baseDate.getFullYear();

    const card = el(
        "article",
        ["day-card", inBaseMonth ? "" : "day-card--muted"]
            .filter(Boolean)
            .join(" "),
    );

    const bg = el("span", "day-card__bg", String(date.getDate()));

    bg.setAttribute("aria-hidden", "true");

    const head = el("div", "day-card__head");

    head.append(
        el("span", "day-card__weekday", shortWeekday(date)),

        el("span", "day-card__date", String(date.getDate())),
    );

    card.append(bg, head, makeLineSet(6, "day-card__lines"));

    return card;
}

/* =========================================================
   FOCUS CARD
========================================================= */

function renderFocusCard(weekStart) {
    const card = el("article", "focus-card");

    card.append(
        el("div", "focus-card__title", "Фокус недели"),

        el("div", "focus-card__range", formatWeekRange(weekStart)),

        makeLineSet(6, "focus-card__lines"),
    );

    return card;
}

/* =========================================================
   WEEK ROW
========================================================= */

function renderWeekRow(weekStart, baseDate) {
    const row = el("section", "week-row");

    for (let i = 0; i < 7; i += 1) {
        row.appendChild(renderDayCard(addDays(weekStart, i), baseDate));
    }

    row.appendChild(renderFocusCard(weekStart));

    return row;
}

/* =========================================================
   MONTH CARD
========================================================= */

function renderMonthCard(monthDate, mode, holidayMap) {
    const card = el("section", `month-card month-card--${mode}`);

    const matrix = getMonthMatrix(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        holidayMap,
    );

    const holidaysThisMonth = [];

    matrix.forEach((week) => {
        week.forEach((cell) => {
            if (cell.isHoliday && cell.inMonth) {
                holidaysThisMonth.push(cell.iso);
            }
        });
    });

    const title = el("div", "month-card__title", monthTitle(monthDate));

    const weekdays = el("div", "month-card__weekdays");

    WEEKDAY_LABELS.forEach((label) => {
        weekdays.appendChild(el("div", "month-card__weekday", label));
    });

    const grid = el("div", "month-card__grid");

    matrix.forEach((week) => {
        week.forEach((cell) => {
            const day = el(
                "div",
                [
                    "month-card__day",

                    cell.inMonth ? "" : "month-card__day--out",

                    cell.isHoliday ? "month-card__day--holiday" : "",
                ]
                    .filter(Boolean)
                    .join(" "),

                String(cell.date.getDate()),
            );

            grid.appendChild(day);
        });
    });

    card.append(title, weekdays, grid);

    return card;
}

/* =========================================================
   NOTES
========================================================= */

function renderNotesCard() {
    const card = el("section", "notes-card");

    card.append(
        el("div", "notes-card__title", "Заметки"),

        makeLineSet(12, "notes-card__lines"),
    );

    return card;
}

/* =========================================================
   FRONT PAGE
========================================================= */

function renderFrontPage(root, baseDate, holidayMap) {
    const weekStart = startOfWeekMonday(baseDate);

    for (let i = 0; i < 4; i += 1) {
        root.appendChild(renderWeekRow(addDays(weekStart, i * 7), baseDate));
    }

    root.appendChild(
        renderMonthCard(addMonths(baseDate, 1), "front", holidayMap),
    );

    root.appendChild(
        renderMonthCard(addMonths(baseDate, 2), "front", holidayMap),
    );
}

/* =========================================================
   BACK PAGE
========================================================= */

function renderBackPage(root, baseDate, holidayMap) {
    root.appendChild(
        renderMonthCard(addMonths(baseDate, 0), "back", holidayMap),
    );

    root.appendChild(
        renderMonthCard(addMonths(baseDate, 1), "back", holidayMap),
    );

    root.appendChild(
        renderMonthCard(addMonths(baseDate, 2), "back", holidayMap),
    );

    root.appendChild(renderNotesCard());
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const baseDate = normalizeDate(new Date());

        const front = document.getElementById("sheet-front");

        const back = document.getElementById("sheet-back");

        if (!front || !back) {
            return;
        }

        const holidayMap = await loadHolidayMap();

        renderFrontPage(front, baseDate, holidayMap);

        renderBackPage(back, baseDate, holidayMap);
    } catch (error) {
        console.error("Ошибка инициализации:", error);
    }
});
