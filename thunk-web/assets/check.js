// thunk check grader. Framework-free, offline; nothing leaves this machine.
//
// Grading parity with thunk_core::Check::grade (thunk-core/src/check.rs):
//   Choice: the checked radio's index must equal data-answer (i == answer).
//   Short:  trim + lowercase both sides, accept if any entry of data-answers
//           matches - the same normalization as Rust's
//           t.trim().to_lowercase() == x.trim().to_lowercase().
// data-answers is joined with "|"; no accepted answer in any checks.ron
// contains a pipe (verified across the whole bank), so a plain split is exact.
(function () {
  "use strict";
  var KEY = "thunk-progress"; // localStorage: the passed check ids, nothing else

  function passed() {
    try {
      var ids = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(ids) ? ids : [];
    } catch (e) {
      return [];
    }
  }

  function recordPass(id) {
    var ids = passed();
    if (ids.indexOf(id) === -1) {
      ids.push(id);
      try {
        localStorage.setItem(KEY, JSON.stringify(ids));
      } catch (e) {
        /* storage denied: grading still works, tally is just not kept */
      }
    }
  }

  function norm(s) {
    return s.trim().toLowerCase();
  }

  // true = correct, false = incorrect, null = nothing to grade yet
  function grade(check) {
    var fieldset = check.querySelector("fieldset[data-answer]");
    if (fieldset) {
      var picked = check.querySelector("input[type=radio]:checked");
      return picked ? picked.value === fieldset.getAttribute("data-answer") : null;
    }
    var input = check.querySelector("input[data-answers]");
    if (!input || norm(input.value) === "") return null;
    var accepted = input.getAttribute("data-answers").split("|");
    var got = norm(input.value);
    return accepted.some(function (a) {
      return norm(a) === got;
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest(".grade") : null;
    if (!button) return;
    var check = button.closest(".check");
    var verdict = check && check.querySelector(".verdict");
    if (!verdict) return;
    var ok = grade(check);
    if (ok === null) {
      verdict.textContent = "pick an answer first";
      verdict.className = "verdict";
      return;
    }
    // The verdict node carries aria-live="polite", so setting its text is the
    // announcement; the words carry the state, the .ok/.err color is secondary.
    verdict.textContent = ok ? "correct" : "not yet - reread and try again";
    verdict.className = ok ? "verdict ok" : "verdict err";
    if (ok) recordPass(check.getAttribute("data-check-id"));
  });

  // Read-only enhancement: on the index, show each module's passed tally.
  var ids = passed();
  var metas = document.querySelectorAll(".meta[data-module]");
  Array.prototype.forEach.call(metas, function (meta) {
    var prefix = meta.getAttribute("data-module").split("-")[0] + "-";
    var count = ids.filter(function (id) {
      return id.indexOf(prefix) === 0;
    }).length;
    if (count > 0) meta.textContent += " · " + count + " passed";
  });
})();
