"use strict";

(() => {
  // Calendar arithmetic uses civil dates. Berlin determines "today" even for
  // visitors elsewhere; UTC below is just a DST-independent day counter.
  const dayMs = 86400000;
  const dayNumber = (year, month, day) => Date.UTC(year, month - 1, day) / dayMs;
  const start = dayNumber(2026, 11, 23);
  const serviceOffsets = [0, 1, 3, 4];
  const berlin = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });

  function currentWeek(now) {
    const parts = Object.fromEntries(berlin.formatToParts(now).map(({type, value}) => [type, Number(value)]));
    const today = dayNumber(parts.year, parts.month, parts.day);
    const weekday = (new Date(today * dayMs).getUTCDay() + 6) % 7;
    const weekend = weekday >= 5;
    const monday = today - weekday + (weekend ? 7 : 0);
    return {
      today, monday, weekend, minutes: parts.hour * 60 + parts.minute,
      weekIndex: monday < start ? -1 : ((monday - start) / 7) % 12,
      selection: weekend ? 0 : serviceOffsets.indexOf(weekday)
    };
  }

  // Gregorian computus; the movable statutory holidays are offsets from Easter.
  function easterSunday(year) {
    const a = year % 19;
    const century = Math.floor(year / 100);
    const within = year % 100;
    const correction = Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3);
    const h = (19 * a + century - Math.floor(century / 4) - correction + 15) % 30;
    const l = (32 + 2 * (century % 4) + 2 * Math.floor(within / 4) - h - within % 4) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const value = h + l - 7 * m + 114;
    return dayNumber(year, Math.floor(value / 31), value % 31 + 1);
  }

  const fixedHolidays = new Set(["01-01", "01-06", "05-01", "10-03", "11-01", "12-25", "12-26"]);
  const easterOffsets = new Set([-2, 1, 39, 50, 60]);

  function closureReason(day, closures) {
    const date = new Date(day * dayMs);
    const iso = date.toISOString().slice(0, 10);
    if (closures.some(({from, to}) => from <= iso && iso <= to)) return "Betriebsferien – an diesem Tag gibt es keinen Mittagstisch.";
    if (fixedHolidays.has(iso.slice(5)) || easterOffsets.has(day - easterSunday(date.getUTCFullYear()))) {
      return "Gesetzlicher Feiertag – an diesem Tag gibt es keinen Mittagstisch.";
    }
    return "";
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {currentWeek, closureReason, dayNumber};
  if (typeof document === "undefined") return;

  const element = id => document.getElementById(id);
  const data = JSON.parse(element("lunch-data").textContent);
  const formatter = options => new Intl.DateTimeFormat("de-DE", {timeZone: "UTC", ...options});
  const weekRange = formatter({day: "numeric", month: "long", year: "numeric"});
  const shortDate = formatter({day: "2-digit", month: "2-digit"});
  const longDate = formatter({day: "2-digit", month: "2-digit", year: "numeric"});
  const weekdays = ["Montag", "Dienstag", "Donnerstag", "Freitag"];
  const categories = ["Fleisch / Fisch", "Pizza", "Pasta", "Alberto Spezial"];
  const prices = ["17,90 €", "12,50 €", "13,90 €", "13,50 €"];
  let calendar;
  let selected;
  let timer;

  function message(id, text) {
    const node = element(id);
    node.textContent = text;
    node.hidden = !text;
  }

  function make(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function showMenu(animate = false) {
    const show = calendar.weekIndex >= 0 && selected >= 0;
    element("lunch-selection").hidden = !show;
    element("lunch-special").hidden = true;
    const list = element("lunch-dishes");
    list.replaceChildren();
    Array.from(element("lunch-days").children).forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === selected));
    });
    if (!show) return;
    const day = calendar.monday + serviceOffsets[selected];
    element("lunch-day").textContent = weekdays[selected] + " · " + longDate.format(day * dayMs);
    const closed = closureReason(day, data.closures);
    let availability = closed;
    if (!closed && day === calendar.today) {
      if (calendar.minutes < 690) availability = "Heute ab 11:30 Uhr.";
      if (calendar.minutes >= 840) availability = "Der heutige Mittagstisch ist beendet.";
    }
    message("lunch-availability", availability);
    if (closed) return;
    const {dishes, side} = data.weeks[calendar.weekIndex][selected];
    dishes.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "lunch-dish";
      const heading = document.createElement("dt");
      heading.append(make("span", "lunch-label", categories[i]), make("span", "lunch-dish-name", name), make("span", "lunch-price", prices[i]));
      const description = data.recipes[name] + (i === 0 ? " Dazu: " + side + "." : "");
      row.append(heading, make("dd", "", description));
      list.append(row);
    });
    element("lunch-special").hidden = false;
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      list.animate([{opacity: 0.2}, {opacity: 1}], {duration: 175, easing: "ease-out"});
    }
  }

  function refresh() {
    const now = new Date();
    const next = currentWeek(now);
    const newDay = !calendar || next.today !== calendar.today;
    const period = minutes => minutes < 690 ? 0 : minutes < 840 ? 1 : 2;
    const newPeriod = !calendar || period(calendar.minutes) !== period(next.minutes);
    calendar = next;
    if (newDay) {
      selected = calendar.selection;
      const active = calendar.weekIndex >= 0;
      element("lunch-launch").hidden = !(calendar.monday === start && calendar.today < start);
      element("lunch-calendar").hidden = false;
      element("lunch-week").textContent = active
        ? weekRange.formatRange(new Date(calendar.monday * dayMs), new Date((calendar.monday + 4) * dayMs))
        : "Ab 23. November 2026";
      let notice = "";
      if (!active) notice = "Unser Mittagstisch startet am 23. November 2026.";
      else if (calendar.weekend) notice = "Vorschau auf die kommende Woche · Am Wochenende bieten wir keinen Mittagstisch an.";
      else if (selected < 0) notice = "Mittwoch ist unser Ruhetag. Unser Restaurant bleibt heute geschlossen. Wählen Sie einen anderen Tag unserer Wochenkarte.";
      message("lunch-notice", notice);
      const days = element("lunch-days");
      days.replaceChildren();
      if (active) serviceOffsets.forEach((offset, i) => {
        const day = calendar.monday + offset;
        const date = shortDate.format(day * dayMs);
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-controls", "lunch-selection");
        button.setAttribute("aria-label", [weekdays[i], date, closureReason(day, data.closures)].filter(Boolean).join(", "));
        button.append(make("strong", "", weekdays[i].slice(0, 2)), " " + date);
        button.addEventListener("click", () => {
          selected = i;
          showMenu(true);
        });
        days.append(button);
      });
    }
    if (newDay || newPeriod) showMenu();
    clearTimeout(timer);
    timer = setTimeout(refresh, 60000 - (Date.now() % 60000));
  }

  refresh();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("pageshow", refresh);
})();
