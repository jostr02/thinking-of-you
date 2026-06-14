// render.js — fetch times.txt, parse it, and build the page.

(function () {
  "use strict";

  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  var DAY_MS = 24 * 60 * 60 * 1000;

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // 7:05 PM style label from a Date
  function clockLabel(dt) {
    var h = dt.getHours();
    var ampm = h < 12 ? "AM" : "PM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + pad(dt.getMinutes()) + " " + ampm;
  }

  function fullDateLabel(dt) {
    return MONTHS[dt.getMonth()] + " " + dt.getDate() + ", " + clockLabel(dt);
  }

  // ---- popups -------------------------------------------------------------

  var tooltip = null;
  var activeDot = null;

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTooltip(dot, entry) {
    var tip = ensureTooltip();
    tip.innerHTML = "";
    var when = document.createElement("div");
    when.className = "tooltip-when";
    // white dots have no note -> just the time; others get the full date + note
    when.textContent = entry.note ? fullDateLabel(entry.datetime) : clockLabel(entry.datetime);
    tip.appendChild(when);
    if (entry.note) {
      var msg = document.createElement("div");
      msg.className = "tooltip-msg";
      msg.textContent = entry.note;
      tip.appendChild(msg);
    }
    tip.classList.add("visible");

    var r = dot.getBoundingClientRect();
    var tr = tip.getBoundingClientRect();
    var left = r.left + r.width / 2 - tr.width / 2 + window.scrollX;
    var top = r.top - tr.height - 10 + window.scrollY;
    if (top < window.scrollY + 4) top = r.bottom + 10 + window.scrollY; // flip below
    left = Math.max(6, Math.min(left, window.scrollX + window.innerWidth - tr.width - 6));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove("visible");
    activeDot = null;
  }

  // ---- lightbox (image dots) ---------------------------------------------

  var lightbox = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.innerHTML =
      '<div class="lightbox-inner">' +
      '<img alt="" />' +
      '<div class="lightbox-when"></div>' +
      '<div class="lightbox-caption"></div>' +
      "</div>";
    lightbox.addEventListener("click", function () {
      lightbox.classList.remove("visible");
    });
    document.body.appendChild(lightbox);
    return lightbox;
  }

  function showLightbox(entry) {
    var lb = ensureLightbox();
    lb.querySelector("img").src = "images/" + entry.img;
    lb.querySelector("img").alt = entry.caption || "memory";
    lb.querySelector(".lightbox-when").textContent = fullDateLabel(entry.datetime);
    lb.querySelector(".lightbox-caption").textContent = entry.caption || "";
    lb.classList.add("visible");
  }

  // ---- timeline build -----------------------------------------------------

  function buildDot(entry) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot dot-" + entry.type;
    // vertical position: 00:00 top -> 23:59 bottom.
    // Inset by 6px each end so midnight/near-midnight dots sit fully inside the bar.
    var frac = (entry.hh * 60 + entry.mm) / (24 * 60);
    dot.style.top = "calc(" + frac + " * (100% - 12px) + 6px)";
    dot.setAttribute("aria-label", clockLabel(entry.datetime));

    if (entry.type === "white") {
      dot.addEventListener("mouseenter", function () { showTooltip(dot, entry); });
      dot.addEventListener("mouseleave", hideTooltip);
    } else if (entry.type === "blue") {
      dot.addEventListener("mouseenter", function () { showTooltip(dot, entry); });
      dot.addEventListener("mouseleave", hideTooltip);
      dot.addEventListener("click", function (e) {
        e.stopPropagation();
        if (activeDot === dot) { hideTooltip(); }
        else { activeDot = dot; showTooltip(dot, entry); }
      });
    } else if (entry.type === "image") {
      dot.addEventListener("click", function (e) {
        e.stopPropagation();
        showLightbox(entry);
      });
    }
    return dot;
  }

  function buildTimeline(entries, mountEl) {
    // group by "YYYY-M" then by day-of-month
    var byMonth = {};
    entries.forEach(function (en) {
      var key = en.datetime.getFullYear() + "-" + en.datetime.getMonth();
      (byMonth[key] = byMonth[key] || []).push(en);
    });

    var keys = Object.keys(byMonth).sort(function (a, b) {
      var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1];
    });

    keys.forEach(function (key) {
      var parts = key.split("-").map(Number);
      var year = parts[0], monthIndex = parts[1];
      var monthEntries = byMonth[key];

      var section = document.createElement("section");
      section.className = "month";

      var h = document.createElement("h2");
      h.className = "month-title";
      h.textContent = MONTHS[monthIndex] + " " + year;
      section.appendChild(h);

      var grid = document.createElement("div");
      grid.className = "day-grid";

      var perDay = {};
      monthEntries.forEach(function (en) {
        var d = en.datetime.getDate();
        (perDay[d] = perDay[d] || []).push(en);
      });

      var n = daysInMonth(year, monthIndex);
      for (var day = 1; day <= n; day++) {
        var col = document.createElement("div");
        col.className = "day-col";

        var bar = document.createElement("div");
        bar.className = "bar";
        (perDay[day] || []).forEach(function (en) {
          bar.appendChild(buildDot(en));
        });
        col.appendChild(bar);

        var label = document.createElement("div");
        label.className = "day-label";
        label.textContent = day;
        col.appendChild(label);

        grid.appendChild(col);
      }

      section.appendChild(grid);
      mountEl.appendChild(section);
    });
  }

  function setCounter(entries) {
    var dollars = (entries.length * 0.05).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    document.getElementById("nickel-amount").textContent = dollars;
  }

  // dismiss tooltip on outside click / escape
  document.addEventListener("click", hideTooltip);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideTooltip();
      if (lightbox) lightbox.classList.remove("visible");
    }
  });

  // ---- boot ---------------------------------------------------------------

  fetch("times.txt")
    .then(function (r) {
      if (!r.ok) throw new Error("could not load times.txt (" + r.status + ")");
      return r.text();
    })
    .then(function (raw) {
      var entries = window.parseTimes(raw);
      setCounter(entries);
      buildTimeline(entries, document.getElementById("timeline"));
    })
    .catch(function (err) {
      var t = document.getElementById("timeline");
      t.innerHTML =
        '<p class="error">' + err.message +
        "<br>Tip: open this page through a local server " +
        "(<code>python -m http.server</code>), not as a file://</p>";
    });
})();
