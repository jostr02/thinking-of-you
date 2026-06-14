// parser.js — turn the raw times.txt note into dated, typed entries.
//
// The source is a chronological list of 12-hour HH:MM times with NO AM/PM,
// segmented by the literal line "Next day". The list begins at midnight on
// New Year's Day 2026. Real time only moves forward, so we resolve every time
// to the earliest datetime (AM or PM) that is >= the previous one.
//
// Two refinements on top of that greedy rule:
//   1) PM-start days. A waking day whose greedy reading lands entirely in the
//      deep night -> pre-evening (e.g. 1:09..10:24 all AM, "bedtime" at 10am)
//      is really an afternoon start. We detect that shape and shift the whole
//      segment +12h so it reads 1:09pm..10:24pm.
//   2) Explicit override. If a time is written with am/pm in times.txt
//      (e.g. "9:27pm"), that is treated as ground truth and the auto PM-shift
//      is disabled for that day. This is the escape hatch for the genuinely
//      ambiguous cases the heuristic can't infer.
//
// Exports parseTimes(rawText) -> Array<Entry>:
//   { date, datetime, hh, mm, rawHour, rawMin, note, type, img, caption }
//
// Runs in the browser (window.parseTimes) and in Node (module.exports).

(function (root) {
  "use strict";

  var START = { y: 2026, m: 0, d: 1 }; // midnight, New Year's Day 2026
  var DAY_MS = 24 * 60 * 60 * 1000;

  // time line: HH:MM, optional am/pm, optional " - " note (or bare trailing text)
  var TIME_RE = /^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?\s*(?:-\s*)?(.*)$/i;

  function mkDate(y, m, d, hh, mm) {
    return new Date(y, m, d, hh || 0, mm || 0, 0, 0);
  }
  function dateOnly(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
  }
  function shift12(dt) {
    return new Date(dt.getTime() + DAY_MS / 2);
  }

  // earliest datetime >= bound whose time-of-day is `min` minutes after midnight
  function atOrAfter(bound, min) {
    var d = mkDate(bound.getFullYear(), bound.getMonth(), bound.getDate(),
      Math.floor(min / 60), min % 60);
    if (d.getTime() < bound.getTime()) {
      d = new Date(d.getTime());
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function amMinutes(h, m) { return (h % 12) * 60 + m; }       // 12 -> 0:00
  function pmMinutes(h, m) { return (h % 12) * 60 + 720 + m; } // 12 -> 12:00

  function classify(note) {
    if (!note) return { type: "white", img: null, caption: null };
    if (/^img:/i.test(note)) {
      var rest = note.replace(/^img:\s*/i, "");
      var sp = rest.indexOf(" ");
      var img = sp === -1 ? rest : rest.slice(0, sp);
      var caption = sp === -1 ? "" : rest.slice(sp + 1).trim();
      return { type: "image", img: img, caption: caption };
    }
    return { type: "blue", img: null, caption: null };
  }

  // tokenize raw text into segments of time-tokens, split on "Next day"
  function tokenize(rawText) {
    var lines = rawText.split(/\r?\n/);
    var segments = [];
    var cur = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/^next day$/i.test(line)) { segments.push(cur); cur = []; continue; }
      var m = line.match(TIME_RE);
      if (!m) continue;
      var ap = m[3] ? (/^a/i.test(m[3]) ? "am" : "pm") : null;
      cur.push({
        rawHour: parseInt(m[1], 10),
        rawMin: parseInt(m[2], 10),
        ap: ap,
        note: (m[4] || "").trim(),
      });
    }
    segments.push(cur);
    return segments;
  }

  // place one token at the earliest valid datetime >= bound, honoring any
  // explicit am/pm; returns a Date
  function placeToken(tok, bound) {
    if (tok.ap === "am") return atOrAfter(bound, amMinutes(tok.rawHour, tok.rawMin));
    if (tok.ap === "pm") return atOrAfter(bound, pmMinutes(tok.rawHour, tok.rawMin));
    var am = atOrAfter(bound, amMinutes(tok.rawHour, tok.rawMin));
    var pm = atOrAfter(bound, pmMinutes(tok.rawHour, tok.rawMin));
    return am.getTime() <= pm.getTime() ? am : pm;
  }

  // a greedily-resolved segment that lands wholly in deep night -> pre-evening
  // is really an afternoon start; flag it for a +12h shift
  function needsPmShift(dts) {
    if (!dts.length) return false;
    var first = dts[0];
    if (first.getHours() > 4) return false;            // started in the morning, fine
    var d0 = first.getDate(), m0 = first.getMonth();
    var maxHour = 0;
    for (var i = 0; i < dts.length; i++) {
      if (dts[i].getDate() !== d0 || dts[i].getMonth() !== m0) return false; // crossed midnight -> had an evening
      if (dts[i].getHours() > maxHour) maxHour = dts[i].getHours();
    }
    return maxHour < 17; // never reached the evening -> the whole day is shifted
  }

  function parseTimes(rawText) {
    var segments = tokenize(rawText);
    var entries = [];
    var wakeDate = mkDate(START.y, START.m, START.d, 0, 0); // date the current day woke up
    var bound = mkDate(START.y, START.m, START.d, 0, 0);    // last placed datetime
    var started = false;

    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      if (!seg.length) continue;

      // ---- "Next day" transition: pick the date this waking day starts on ----
      if (started) {
        var prevLastDate = dateOnly(bound);
        if (prevLastDate.getTime() > wakeDate.getTime()) {
          // previous day already ran past midnight into the early hours; that
          // wrapped date IS the day we woke on. Keep the running clock so a late
          // start reads PM and time stays monotonic.
          wakeDate = prevLastDate;
        } else {
          // clean evening -> next morning: advance a full calendar day and
          // expect the first entry to be in the morning (AM).
          wakeDate = new Date(wakeDate.getTime());
          wakeDate.setDate(wakeDate.getDate() + 1);
          bound = mkDate(wakeDate.getFullYear(), wakeDate.getMonth(), wakeDate.getDate(), 0, 0);
        }
      }
      started = true;

      // ---- place each entry at the earliest valid time >= the previous ----
      var dts = [];
      var hasOverride = false;
      for (var i = 0; i < seg.length; i++) {
        if (seg[i].ap) hasOverride = true;
        var dt = placeToken(seg[i], bound);
        dts.push(dt);
        bound = dt;
      }

      // ---- PM-start correction (skipped when the writer set am/pm by hand) ----
      if (!hasOverride && needsPmShift(dts)) {
        for (var j = 0; j < dts.length; j++) dts[j] = shift12(dts[j]);
        bound = dts[dts.length - 1];
      }
      wakeDate = dateOnly(dts[0]);

      for (var k = 0; k < seg.length; k++) {
        var d = dts[k];
        var meta = classify(seg[k].note);
        entries.push({
          date: dateOnly(d),
          datetime: d,
          hh: d.getHours(),
          mm: d.getMinutes(),
          rawHour: seg[k].rawHour,
          rawMin: seg[k].rawMin,
          note: seg[k].note,
          type: meta.type,
          img: meta.img,
          caption: meta.caption,
        });
      }
    }

    return entries;
  }

  root.parseTimes = parseTimes;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseTimes: parseTimes };
  }
})(typeof window !== "undefined" ? window : globalThis);
