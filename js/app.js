(function () {
  var METHODS = [
    {
      id: "today",
      name: "شغل اليوم",
      sentence: "نستخدم هذه المعلومة الآن أو خلال هذا اليوم لنكمل العمل الجاري، مثل: هل المخزون يكفي، من الحاضر في الوردية، أو فاتورة يجب دفعها اليوم."
    },
    {
      id: "follow",
      name: "متابعة الأقسام",
      sentence: "نراجع هذه الأرقام خلال فترة، مثل أسبوع أو شهر، لنتابع سير القسم ونحسّنه: المبيعات، الغياب، الموردون، أو الربح والخسارة."
    },
    {
      id: "future",
      name: "قرار المستقبل",
      sentence: "نستخدم هذه المعلومة لقرار كبير يغيّر اتجاه المؤسسة لسنوات، مثل فتح فرع، أو دخول سوق جديد، أو تغيير الخطة بسبب قانون أو تقنية."
    },
    {
      id: "trust",
      name: "صدق البيانات",
      sentence: "المشكلة أن هذه المعلومة لا يُعتمد عليها: مصدرها ضعيف، أو العينة صغيرة والناس متشابهون، أو الكلام منقول من غير الرجوع إلى الأصل."
    },
    {
      id: "worth",
      name: "الوقت والقيمة",
      sentence: "إمّا وصلت البيانات متأخرة فصارت قديمة ولم تعد تفيد، أو جمعها يضيّع وقتاً ومالاً بلا فائدة، أو دلّت على أن الحل الأرخص يكفي."
    }
  ];
  var TRACK = {
    choice: "اختيار إجابة",
    next: "السؤال التالي",
    prev: "السؤال السابق",
    dot: "الانتقال لسؤال",
    submit: "تسليم الاختبار",
    start: "بدء الاختبار",
    "nav-lesson": "قائمة الشرح",
    "nav-exam": "قائمة الاختبار",
    medal: "بطاقة طريقة",
    "go-exam": "الانتقال إلى الاختبار",
    "review-lesson": "العودة للشرح",
    retry: "محاولة جديدة",
    confirm: "تأكيد التسليم",
    cancel: "مراجعة الإجابات"
  };
  var QUIZ = window.QUIZ || [];
  var advanceTimer = 0;
  var nameInput = document.getElementById("student-name");
  var classInput = document.getElementById("student-class");
  var root = document.getElementById("exam-root");
  var clock = document.getElementById("live-clock");
  var hiddenMark = 0;
  var state = blankState();

  restore();
  render();
  bind();
  if (state.phase === "exam") scrollQuestion();

  function blankState() {
    return {
      sessionId: newId(),
      phase: "gate",
      origin: Date.now(),
      examStart: 0,
      submittedAt: 0,
      hiddenMs: 0,
      clicks: 0,
      clickLog: [],
      answerChanges: 0,
      backMoves: 0,
      readPercent: 0,
      index: 0,
      confirming: false,
      qState: QUIZ.map(function () {
        return { chosen: "", ms: 0, clicks: 0, changes: 0, entered: 0, options: null };
      })
    };
  }

  function newId() {
    return "od-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function methodById(id) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i];
    return null;
  }

  function methodName(id) {
    var method = methodById(id);
    return method ? method.name : "";
  }

  function methodSentence(id) {
    var method = methodById(id);
    return method ? method.sentence : "";
  }

  function shuffleWith(list, seed) {
    var arr = list.slice();
    var value = seed;
    for (var i = arr.length - 1; i > 0; i--) {
      value = (value * 1103515245 + 12345) & 0x7fffffff;
      var j = value % (i + 1);
      var swap = arr[i];
      arr[i] = arr[j];
      arr[j] = swap;
    }
    return arr;
  }

  function optionsFor(index) {
    var q = state.qState[index];
    if (q.options && q.options.length === 3) return q.options;
    var correct = QUIZ[index].answer;
    var others = [];
    METHODS.forEach(function (method) {
      if (method.id !== correct) others.push(method.id);
    });
    others = shuffleWith(others, QUIZ[index].id * 97);
    q.options = shuffleWith([correct, others[0], others[1]], QUIZ[index].id * 13);
    return q.options;
  }

  function studentName() {
    return nameInput.value.trim();
  }

  function formatDuration(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    if (h) return h + ":" + pad(m) + ":" + pad(r);
    return m + ":" + pad(r);
  }

  function stamp(ms) {
    try {
      return new Date(ms).toLocaleString("ar-EG", { timeZone: "Asia/Amman", hour12: false });
    } catch (err) {
      return new Date(ms).toLocaleString();
    }
  }

  function gradeOf(percent) {
    if (percent >= 90) return "ممتاز";
    if (percent >= 80) return "جيد جداً";
    if (percent >= 70) return "جيد";
    if (percent >= 60) return "مقبول";
    return "يحتاج مراجعة";
  }

  function hiddenNow() {
    var extra = hiddenMark ? Date.now() - hiddenMark : 0;
    return state.hiddenMs + extra;
  }

  function studyMs() {
    var end = state.examStart || Date.now();
    return Math.max(0, end - state.origin);
  }

  function examMs() {
    if (!state.examStart) return 0;
    return Math.max(0, (state.submittedAt || Date.now()) - state.examStart);
  }

  function answeredCount() {
    var n = 0;
    state.qState.forEach(function (q) { if (q.chosen) n += 1; });
    return n;
  }

  function flushTime() {
    var q = state.qState[state.index];
    if (!q || !q.entered) return;
    q.ms += Date.now() - q.entered;
    q.entered = 0;
  }

  function armTime() {
    var q = state.qState[state.index];
    if (q && state.phase === "exam" && !state.submittedAt && !document.hidden) q.entered = Date.now();
  }

  function restore() {
    nameInput.value = localStorage.getItem("od-name") || "";
    classInput.value = localStorage.getItem("od-class") || "";
    var done = null;
    var live = null;
    try { done = JSON.parse(sessionStorage.getItem("od-result") || "null"); } catch (e1) {}
    try { live = JSON.parse(sessionStorage.getItem("od-live") || "null"); } catch (e2) {}
    if (done && done.pack) {
      state.sessionId = done.pack.sessionId || state.sessionId;
      state.phase = "result";
      state.resultPack = done.pack;
      state.submittedAt = done.submittedAt || Date.now();
      state.examStart = done.examStart || 0;
      state.origin = done.origin || state.origin;
      return;
    }
    if (!live || !live.sessionId) return;
    state.sessionId = live.sessionId;
    state.origin = live.origin || state.origin;
    state.examStart = live.examStart || 0;
    state.hiddenMs = live.hiddenMs || 0;
    state.clicks = live.clicks || 0;
    state.clickLog = live.clickLog || [];
    state.answerChanges = live.answerChanges || 0;
    state.backMoves = live.backMoves || 0;
    state.readPercent = live.readPercent || 0;
    state.index = live.index || 0;
    if (live.qState && live.qState.length === QUIZ.length) {
      state.qState = live.qState.map(function (q) {
        return { chosen: q.chosen || "", ms: q.ms || 0, clicks: q.clicks || 0, changes: q.changes || 0, entered: 0, options: q.options || null };
      });
    }
    if (live.phase === "exam") state.phase = "exam";
    armTime();
  }

  function persistLive() {
    if (state.phase === "result") return;
    var pack = {
      sessionId: state.sessionId,
      origin: state.origin,
      examStart: state.examStart,
      hiddenMs: state.hiddenMs,
      clicks: state.clicks,
      clickLog: state.clickLog.slice(-300),
      answerChanges: state.answerChanges,
      backMoves: state.backMoves,
      readPercent: state.readPercent,
      index: state.index,
      phase: state.phase,
      qState: state.qState.map(function (q) {
        return { chosen: q.chosen, ms: q.ms, clicks: q.clicks, changes: q.changes, options: q.options };
      })
    };
    try { sessionStorage.setItem("od-live", JSON.stringify(pack)); } catch (err) {}
  }

  function rows() {
    return QUIZ.map(function (item, i) {
      var q = state.qState[i];
      var label = !q.chosen ? "بدون إجابة" : (q.chosen === item.answer ? "صحيحة" : "خاطئة");
      return {
        n: item.id,
        text: item.text,
        chosen: methodName(q.chosen),
        chosenId: q.chosen,
        correct: methodName(item.answer),
        correctId: item.answer,
        ok: label,
        seconds: Math.max(0, Math.round(q.ms / 1000)),
        clicks: q.clicks,
        changes: q.changes,
        why: methodSentence(item.answer)
      };
    });
  }

  function methodSplit(list) {
    return METHODS.map(function (m) {
      var all = 0;
      var ok = 0;
      list.forEach(function (row) {
        if (row.correctId !== m.id) return;
        all += 1;
        if (row.ok === "صحيحة") ok += 1;
      });
      return m.name + " " + ok + "/" + all;
    }).join(" | ");
  }

  function buildPack(eventName, rich) {
    var list = rows();
    var correct = 0;
    var wrong = 0;
    var blank = 0;
    var answered = 0;
    list.forEach(function (row) {
      if (row.ok === "صحيحة") correct += 1;
      else if (row.ok === "خاطئة") wrong += 1;
      else blank += 1;
      if (row.chosenId) answered += 1;
    });
    var finished = eventName === "submit";
    var percent = finished ? Math.round((correct / QUIZ.length) * 100) : "";
    var pack = {
      kind: "org-data",
      event: eventName,
      sessionId: state.sessionId,
      name: studentName(),
      klass: classInput.value.trim(),
      status: finished ? "أنهى" : (state.examStart ? "داخل الاختبار" : "قبل البدء"),
      grade: finished ? gradeOf(percent) : "",
      score: finished ? correct : "",
      total: QUIZ.length,
      percent: percent,
      correct: finished ? correct : "",
      wrong: finished ? wrong : "",
      blank: finished ? blank : "",
      answeredCount: answered,
      currentQuestion: state.examStart ? state.index + 1 : 0,
      examText: state.examStart ? formatDuration(examMs()) : "—",
      examSeconds: Math.round(examMs() / 1000),
      studyText: formatDuration(studyMs()),
      studySeconds: Math.round(studyMs() / 1000),
      readPercent: state.readPercent,
      hiddenText: formatDuration(hiddenNow()),
      hiddenSeconds: Math.round(hiddenNow() / 1000),
      clicks: state.clicks,
      answerChanges: state.answerChanges,
      backMoves: state.backMoves,
      startedAt: stamp(state.origin),
      submittedAt: finished ? stamp(state.submittedAt || Date.now()) : "",
      lastSeen: stamp(Date.now()),
      methodSplit: finished ? methodSplit(list) : "",
      answers: rich ? list : [],
      clicksLog: rich ? state.clickLog.slice(-300) : []
    };
    return pack;
  }

  function cloudUrl() {
    return String((window.ORG_DATA_CLOUD || {}).sheetsUrl || "").trim();
  }

  function sheetLink() {
    var id = String((window.ORG_DATA_CLOUD || {}).sheetId || "").trim();
    return id ? "https://docs.google.com/spreadsheets/d/" + id + "/edit" : "";
  }

  function saveLocal(pack) {
    var all = [];
    try { all = JSON.parse(localStorage.getItem("od-local-results") || "[]"); } catch (err) {}
    if (!Array.isArray(all)) all = [];
    var found = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].sessionId === pack.sessionId) {
        if (all[i].status === "أنهى" && pack.status !== "أنهى") return;
        all[i] = pack;
        found = true;
      }
    }
    if (!found) all.push(pack);
    if (all.length > 40) all = all.slice(-40);
    try { localStorage.setItem("od-local-results", JSON.stringify(all)); } catch (err2) {}
  }

  function ensureSink() {
    var iframe = document.getElementById("dmSink");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.name = "dmSink";
      iframe.id = "dmSink";
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(iframe);
    }
    var form = document.getElementById("dmCloudForm");
    if (!form) {
      form = document.createElement("form");
      form.id = "dmCloudForm";
      form.method = "POST";
      form.target = "dmSink";
      form.acceptCharset = "UTF-8";
      form.style.display = "none";
      ["payload", "data"].forEach(function (name) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        form.appendChild(input);
      });
      document.body.appendChild(form);
    }
    return form;
  }

  function send(eventName, rich) {
    if (!studentName()) return;
    flushTime();
    if (state.phase === "exam") armTime();
    var pack = buildPack(eventName, rich);
    saveLocal(pack);
    saveFile(pack);
    var url = cloudUrl();
    if (!url) return pack;
    var body = JSON.stringify(pack);
    try {
      if (eventName === "progress" && document.visibilityState === "hidden") {
        fetch(url, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: "payload=" + encodeURIComponent(body)
        });
      } else {
        var form = ensureSink();
        form.action = url;
        form.querySelector("[name=payload]").value = body;
        form.querySelector("[name=data]").value = body;
        form.submit();
      }
    } catch (err) {}
    return pack;
  }

  function saveFile(pack) {
    try {
      fetch("/save", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pack)
      }).catch(function () {});
    } catch (err) {}
  }

  function bind() {
    document.getElementById("who").addEventListener("submit", function (e) { e.preventDefault(); });
    nameInput.addEventListener("change", function () {
      localStorage.setItem("od-name", studentName());
      send("progress", false);
    });
    classInput.addEventListener("change", function () {
      localStorage.setItem("od-class", classInput.value.trim());
      send("progress", false);
    });
    document.addEventListener("click", function (e) {
      state.clicks += 1;
      var el = e.target.closest("[data-track]");
      var key = el ? el.getAttribute("data-track") : "";
      if (state.clickLog.length < 300) {
        state.clickLog.push({
          t: Math.round((Date.now() - state.origin) / 1000),
          q: state.phase === "exam" ? String(state.index + 1) : "",
          target: TRACK[key] || "نقرة في الصفحة"
        });
      }
      if (state.phase === "exam" && !state.submittedAt && state.qState[state.index]) {
        state.qState[state.index].clicks += 1;
      }
    }, true);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        flushTime();
        if (!hiddenMark) hiddenMark = Date.now();
      } else {
        if (hiddenMark) {
          state.hiddenMs += Date.now() - hiddenMark;
          hiddenMark = 0;
        }
        armTime();
      }
    });
    window.addEventListener("pagehide", function () {
      if (state.phase === "result") return;
      send("progress", true);
    });
    window.addEventListener("scroll", function () {
      var lesson = document.getElementById("lesson");
      if (!lesson) return;
      var start = lesson.offsetTop;
      var height = lesson.offsetHeight || 1;
      var seen = window.scrollY + window.innerHeight - start;
      var pct = Math.max(0, Math.min(100, Math.round((seen / height) * 100)));
      if (pct > state.readPercent) state.readPercent = pct;
    }, { passive: true });
    setInterval(function () {
      if (state.phase === "exam" && state.examStart && !state.submittedAt) {
        clock.hidden = false;
        clock.textContent = formatDuration(examMs());
      }
      if (studentName() && state.phase !== "result") send("progress", false);
    }, 25000);
    setInterval(function () {
      if (state.phase === "exam" && state.examStart && !state.submittedAt) {
        clock.hidden = false;
        clock.textContent = formatDuration(examMs());
      }
    }, 1000);
    root.addEventListener("click", onExamClick);
  }

  var unitIndex = 0;
  var studyReady = false;

  function methodNodes() {
    return Array.prototype.slice.call(document.querySelectorAll("#lesson .method"));
  }

  function initUnits() {
    var savedUnit = 0;
    try { savedUnit = Number(sessionStorage.getItem("od-unit") || 0); } catch (err) {}
    if (sessionStorage.getItem("od-ready") === "1") studyReady = true;
    document.getElementById("unit-prev").addEventListener("click", function () {
      showUnit(unitIndex - 1);
    });
    document.getElementById("unit-next").addEventListener("click", function () {
      var list = methodNodes();
      var index = unitIndex;
      list.forEach(function (unit, i) {
        if (unit.classList.contains("is-current")) index = i;
      });
      if (index < list.length - 1) showUnit(index + 1);
      else showReady();
    });
    document.querySelectorAll(".medal").forEach(function (link, index) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        showUnit(index);
      });
    });
    var examLink = document.querySelector("[data-track=nav-exam]");
    if (examLink) {
      examLink.addEventListener("click", function (event) {
        event.preventDefault();
        if (studyReady || state.examStart || state.phase === "result" || state.phase === "exam") {
          openExam();
          return;
        }
        var hint = document.getElementById("unit-hint");
        if (hint) hint.textContent = "أكمل قراءة الصفحات الخمس أولاً.";
        document.getElementById("lesson").scrollIntoView({ behavior: "smooth" });
      });
    }
    document.getElementById("go-exam").addEventListener("click", openExam);
    if (studyReady || state.phase === "exam" || state.phase === "result") openExam();
    else showUnit(isFinite(savedUnit) ? savedUnit : 0);
  }

  function showUnit(index) {
    var list = methodNodes();
    if (!list.length) return;
    unitIndex = Math.max(0, Math.min(list.length - 1, index));
    var reviewing = !!(state.examStart || state.phase === "result");
    if (!reviewing) {
      studyReady = false;
      try { sessionStorage.removeItem("od-ready"); } catch (err) {}
    }
    try { sessionStorage.setItem("od-unit", String(unitIndex)); } catch (err2) {}
    list.forEach(function (unit, i) {
      unit.classList.toggle("is-current", i === unitIndex);
      unit.style.removeProperty("display");
    });
    document.getElementById("ready").hidden = true;
    document.getElementById("to-exam").hidden = true;
    document.getElementById("exam").hidden = true;
    document.getElementById("unit-bar").hidden = false;
    document.getElementById("unit-count").textContent = "الصفحة " + (unitIndex + 1) + " من " + list.length;
    document.getElementById("unit-prev").disabled = unitIndex === 0;
    var next = document.getElementById("unit-next");
    next.textContent = unitIndex === list.length - 1 ? "أنهيت القراءة" : "الصفحة التالية";
    var seen = Math.round(((unitIndex + 1) / list.length) * 100);
    if (seen > state.readPercent) state.readPercent = seen;
    list[unitIndex].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showReady() {
    studyReady = false;
    methodNodes().forEach(function (unit) {
      unit.classList.remove("is-current");
      unit.style.removeProperty("display");
    });
    document.getElementById("unit-bar").hidden = true;
    document.getElementById("ready").hidden = false;
    document.getElementById("to-exam").hidden = false;
    document.getElementById("exam").hidden = true;
    state.readPercent = 100;
    document.getElementById("to-exam").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openExam() {
    studyReady = true;
    try { sessionStorage.setItem("od-ready", "1"); } catch (err) {}
    methodNodes().forEach(function (unit) {
      unit.classList.remove("is-current");
      unit.style.removeProperty("display");
    });
    document.getElementById("unit-bar").hidden = true;
    document.getElementById("ready").hidden = true;
    document.getElementById("to-exam").hidden = true;
    document.getElementById("exam").hidden = false;
    state.readPercent = 100;
    document.getElementById("exam").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render() {
    if (state.phase === "result") renderResult(state.resultPack || buildPack("submit", true));
    else if (state.phase === "exam") renderExam();
    else renderGate();
    if (state.phase === "exam") {
      clock.hidden = false;
      clock.textContent = formatDuration(examMs());
    }
  }

  function renderGate() {
    root.innerHTML = "";
    var card = document.createElement("div");
    card.className = "gate";
    var p = document.createElement("p");
    p.textContent = "اكتبي اسمك في الأعلى ثم ابدئي. اقرئي الحالة، ثم اختاري الجملة التي تصف ما تفعله المؤسسة بهذه البيانات.";
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.id = "gate-hint";
    var btn = document.createElement("button");
    btn.className = "btn primary";
    btn.type = "button";
    btn.setAttribute("data-track", "start");
    btn.setAttribute("data-act", "start");
    btn.textContent = "ابدئي الاختبار";
    card.appendChild(p);
    card.appendChild(hint);
    card.appendChild(btn);
    root.appendChild(card);
  }

  function renderExam() {
    var item = QUIZ[state.index];
    var chosen = state.qState[state.index].chosen;
    var revealed = !!chosen;
    root.innerHTML = "";
    var card = document.createElement("div");
    card.className = "qcard";
    card.id = "qcard";

    var top = document.createElement("div");
    top.className = "q-top";
    var count = document.createElement("strong");
    count.textContent = "السؤال " + item.id + " من " + QUIZ.length;
    top.appendChild(count);

    var meter = document.createElement("div");
    meter.className = "meter";
    var bar = document.createElement("b");
    bar.style.width = Math.round((answeredCount() / QUIZ.length) * 100) + "%";
    meter.appendChild(bar);

    var text = document.createElement("p");
    text.className = "q-text";
    text.textContent = item.text;

    var ask = document.createElement("p");
    ask.className = "ask";
    ask.textContent = "أي جملة تصف هذه الحالة؟";

    var list = document.createElement("div");
    list.className = "choice-list";
    optionsFor(state.index).forEach(function (methodId) {
      var method = null;
      METHODS.forEach(function (itemMethod) {
        if (itemMethod.id === methodId) method = itemMethod;
      });
      if (!method) return;
      var btn = document.createElement("button");
      var mark = "";
      if (revealed && method.id === item.answer) mark = " is-right";
      else if (revealed && method.id === chosen) mark = " is-wrong";
      btn.type = "button";
      btn.className = "choice" + mark;
      btn.disabled = revealed;
      btn.setAttribute("data-track", "choice");
      btn.setAttribute("data-act", "choose");
      btn.setAttribute("data-method", method.id);
      btn.setAttribute("aria-pressed", chosen === method.id ? "true" : "false");
      var dot = document.createElement("i");
      var label = document.createElement("span");
      label.textContent = method.sentence;
      btn.appendChild(dot);
      btn.appendChild(label);
      list.appendChild(btn);
    });

    var hint = document.createElement("p");
    hint.className = "hint";
    hint.id = "q-hint";
    if (revealed && chosen === item.answer) {
      hint.className = "hint good";
      hint.textContent = "إجابة صحيحة. " + methodSentence(item.answer);
    } else if (revealed) {
      hint.textContent = "الجملة الأقرب: " + methodSentence(item.answer);
    }

    var pager = document.createElement("div");
    pager.className = "pager";
    pager.appendChild(actionButton("السابق", "prev", "ghost", state.index === 0));
    var mid = document.createElement("span");
    mid.textContent = "أُجيب عن " + answeredCount() + " من " + QUIZ.length;
    pager.appendChild(mid);
    if (state.index < QUIZ.length - 1) pager.appendChild(actionButton("التالي", "next", "primary", false));
    else pager.appendChild(actionButton("تسليم الاختبار", "submit", "primary", false));

    var dots = document.createElement("div");
    dots.className = "dots";
    QUIZ.forEach(function (q, i) {
      var dot = document.createElement("button");
      var answered = state.qState[i].chosen;
      var tone = "";
      if (answered) tone = answered === q.answer ? " is-good" : " is-bad";
      dot.type = "button";
      dot.className = "dot" + (i === state.index ? " is-on" : "") + tone;
      dot.setAttribute("data-track", "dot");
      dot.setAttribute("data-act", "goto");
      dot.setAttribute("data-i", String(i));
      dot.textContent = String(q.id);
      dots.appendChild(dot);
    });

    card.appendChild(top);
    card.appendChild(meter);
    card.appendChild(text);
    card.appendChild(ask);
    card.appendChild(list);
    card.appendChild(hint);
    card.appendChild(pager);
    card.appendChild(dots);
    if (state.confirming) card.appendChild(confirmBox());
    root.appendChild(card);
  }

  function confirmBox() {
    var box = document.createElement("div");
    box.className = "confirm";
    var p = document.createElement("p");
    p.textContent = "تسليم الإجابات الآن؟";
    var actions = document.createElement("div");
    actions.className = "yesno";
    actions.appendChild(actionButton("نعم، سلّم", "confirm", "primary", false));
    actions.appendChild(actionButton("راجع الإجابات", "cancel", "ghost", false));
    box.appendChild(p);
    box.appendChild(actions);
    return box;
  }

  function actionButton(label, act, style, disabled) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn " + style;
    btn.textContent = label;
    btn.disabled = !!disabled;
    btn.setAttribute("data-track", act);
    btn.setAttribute("data-act", act);
    return btn;
  }

  function onExamClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    var act = btn.getAttribute("data-act");
    if (act === "start") return startExam();
    if (act === "choose") return choose(btn.getAttribute("data-method"));
    if (act === "next") return go(state.index + 1, true);
    if (act === "prev") return go(state.index - 1, false);
    if (act === "goto") return go(Number(btn.getAttribute("data-i")), false);
    if (act === "submit") return askSubmit();
    if (act === "confirm") return submitExam();
    if (act === "cancel") {
      state.confirming = false;
      renderExam();
    }
    if (act === "retry") return retry();
    if (act === "review-lesson") document.getElementById("lesson").scrollIntoView({ behavior: "smooth" });
  }

  function startExam() {
    if (!studentName()) {
      var hint = document.getElementById("gate-hint");
      if (hint) hint.textContent = "اكتبي اسمك في أعلى الصفحة أولاً.";
      nameInput.focus();
      return;
    }
    localStorage.setItem("od-name", studentName());
    localStorage.setItem("od-class", classInput.value.trim());
    if (!state.examStart) state.examStart = Date.now();
    state.phase = "exam";
    state.confirming = false;
    armTime();
    render();
    scrollQuestion();
    persistLive();
    send("progress", false);
  }

  function choose(id) {
    var q = state.qState[state.index];
    if (q.chosen) return;
    var here = state.index;
    q.chosen = id;
    renderExam();
    persistLive();
    if (answeredCount() % 5 === 0) send("progress", true);
    window.clearTimeout(advanceTimer);
    if (here < QUIZ.length - 1) {
      var wait = q.chosen === QUIZ[here].answer ? 1600 : 3400;
      advanceTimer = window.setTimeout(function () {
        if (state.phase === "exam" && state.index === here && !state.confirming) go(here + 1, false);
      }, wait);
    }
  }

  function go(index, requireAnswer) {
    window.clearTimeout(advanceTimer);
    if (index < 0 || index >= QUIZ.length) return;
    if (requireAnswer && !state.qState[state.index].chosen) {
      var hint = document.getElementById("q-hint");
      var card = document.getElementById("qcard");
      if (hint) hint.textContent = "اختر إجابة قبل المتابعة. يمكنك التنقل من الأرقام إن أردت العودة لاحقاً.";
      if (card) {
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      }
      return;
    }
    if (index < state.index) state.backMoves += 1;
    flushTime();
    state.index = index;
    state.confirming = false;
    armTime();
    renderExam();
    scrollQuestion();
    persistLive();
  }

  function scrollQuestion() {
    var card = document.getElementById("qcard");
    if (card) card.scrollIntoView({ block: "start" });
  }

  function askSubmit() {
    var missing = [];
    state.qState.forEach(function (q, i) { if (!q.chosen) missing.push(QUIZ[i].id); });
    if (missing.length) {
      var hint = document.getElementById("q-hint");
      if (hint) hint.textContent = "تبقّى دون إجابة: " + missing.slice(0, 12).join("، ") + (missing.length > 12 ? "..." : "");
      return;
    }
    state.confirming = true;
    renderExam();
  }

  function submitExam() {
    flushTime();
    state.submittedAt = Date.now();
    state.phase = "result";
    state.confirming = false;
    var pack = send("submit", true) || buildPack("submit", true);
    state.resultPack = pack;
    try {
      sessionStorage.removeItem("od-live");
      sessionStorage.setItem("od-result", JSON.stringify({
        pack: pack,
        submittedAt: state.submittedAt,
        examStart: state.examStart,
        origin: state.origin
      }));
    } catch (err) {}
    renderResult(pack);
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderResult(pack) {
    root.innerHTML = "";
    var card = document.createElement("div");
    card.className = "result";
    var grid = document.createElement("div");
    grid.className = "result-grid";
    var ring = document.createElement("div");
    ring.className = "ring";
    ring.style.setProperty("--p", "0");
    var hole = document.createElement("div");
    hole.className = "ring-hole";
    var score = document.createElement("strong");
    score.textContent = String(pack.score);
    var of = document.createElement("em");
    of.textContent = "من " + pack.total;
    hole.appendChild(score);
    hole.appendChild(of);
    ring.appendChild(hole);

    var side = document.createElement("div");
    var h = document.createElement("h3");
    h.textContent = pack.grade + " · " + pack.percent + "%";
    side.appendChild(h);
    (pack.methodSplit || "").split(" | ").forEach(function (part) {
      if (!part) return;
      var bits = part.split(" ");
      var ratio = bits.pop();
      var name = bits.join(" ");
      var nums = ratio.split("/");
      var pct = nums[1] ? Math.round((Number(nums[0]) / Number(nums[1])) * 100) : 0;
      var row = document.createElement("div");
      row.className = "bar-row";
      var label = document.createElement("span");
      label.textContent = name;
      var track = document.createElement("div");
      track.className = "track";
      var fill = document.createElement("i");
      var method = METHODS.filter(function (m) { return m.name === name; })[0];
      fill.style.background = "var(--c)";
      row.style.setProperty("--c", method ? colorOf(method.id) : "var(--teal)");
      track.appendChild(fill);
      var b = document.createElement("b");
      b.textContent = ratio;
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(b);
      side.appendChild(row);
      requestAnimationFrame(function () { fill.style.width = pct + "%"; });
    });

    grid.appendChild(ring);
    grid.appendChild(side);
    card.appendChild(grid);

    var mistakes = (pack.answers || []).filter(function (row) { return row.ok !== "صحيحة"; });
    var title = document.createElement("h3");
    title.textContent = mistakes.length ? "أسئلة تحتاج مراجعة" : "إجاباتك مطابقة للتصنيفات الخمسة.";
    card.appendChild(title);
    mistakes.forEach(function (row) {
      var box = document.createElement("div");
      box.className = "mistake";
      var q = document.createElement("p");
      q.textContent = row.n + ". " + row.text;
      var yours = document.createElement("p");
      yours.innerHTML = "";
      var y1 = document.createElement("span");
      y1.textContent = "إجابتك: ";
      var y2 = document.createElement("b");
      y2.textContent = row.chosen || "بدون إجابة";
      yours.appendChild(y1);
      yours.appendChild(y2);
      var right = document.createElement("p");
      right.className = "ok";
      right.textContent = "الجملة الأقرب: " + row.why;
      box.appendChild(q);
      box.appendChild(yours);
      box.appendChild(right);
      card.appendChild(box);
    });

    var actions = document.createElement("div");
    actions.className = "result-actions";
    actions.appendChild(actionButton("محاولة جديدة", "retry", "primary", false));
    card.appendChild(actions);
    root.appendChild(card);
    requestAnimationFrame(function () { ring.style.setProperty("--p", String(pack.percent || 0)); });
  }

  function colorOf(id) {
    return {
      future: "var(--future)",
      follow: "var(--follow)",
      today: "var(--today)",
      trust: "var(--trust)",
      worth: "var(--worth)"
    }[id] || "var(--teal)";
  }

  function retry() {
    sessionStorage.removeItem("od-live");
    sessionStorage.removeItem("od-result");
    var name = studentName();
    var klass = classInput.value;
    state = blankState();
    nameInput.value = name;
    classInput.value = klass;
    clock.hidden = true;
    render();
    document.getElementById("exam").scrollIntoView({ behavior: "smooth" });
  }
})();
