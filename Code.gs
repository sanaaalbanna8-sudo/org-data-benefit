/**
 * كيف تستفيد المؤسسة من البيانات — نتائج الاختبار
 *
 * 1. أنشئ جدولاً في جوجل، ثم: الإضافات ← Apps Script، والصق هذا الملف مكان Code.gs.
 * 2. انشر: تطبيق ويب، التنفيذ: أنا، الوصول: أي شخص.
 * 3. الصق معرّف الجدول ورابط /exec في js/config.js.
 *
 * لوحة المعلم: teacher.html
 * مفتاح الدخول: sanaa21
 *
 * الأوراق التي تُنشأ تلقائياً:
 * النتائج، الإجابات، الأخطاء، النقرات
 */

var SHEET_ID = "";
var TEACHER_KEY = "sanaa21";

var HEAD_SUMMARY = [
  "معرّف المحاولة", "الاسم", "الشعبة", "الحالة", "التقدير",
  "الدرجة", "من", "النسبة", "الصحيحة", "الخاطئة", "غير المجاب",
  "أسئلة مجاب عنها", "السؤال الحالي",
  "مدة الاختبار", "ثواني الاختبار",
  "وقت قراءة الشرح", "ثواني الشرح", "نسبة قراءة الشرح",
  "وقت غياب النافذة", "ثواني الغياب",
  "عدد النقرات", "تغييرات الإجابة", "مرات الرجوع",
  "بداية الاستخدام", "وقت التسليم", "آخر ظهور", "تفصيل التصنيف"
];

var HEAD_ANSWERS = [
  "معرّف المحاولة", "الاسم", "الشعبة", "رقم السؤال", "نص السؤال",
  "إجابة الطالب", "الإجابة الصحيحة", "النتيجة",
  "ثواني السؤال", "نقرات السؤال", "تغييرات السؤال", "سبب التصنيف"
];

var HEAD_MISTAKES = [
  "معرّف المحاولة", "الاسم", "الشعبة", "رقم السؤال", "نص السؤال",
  "إجابة الطالب", "الإجابة الصحيحة", "النتيجة", "سبب التصنيف"
];

var HEAD_CLICKS = [
  "معرّف المحاولة", "الاسم", "الشعبة", "ثانية النقرة", "رقم السؤال", "العنصر"
];

function doGet(e) {
  var view = e && e.parameter ? String(e.parameter.view || "") : "";
  if (view === "board") {
    if (!keyOk_(e)) return scriptOut_(e, { ok: false, error: "المفتاح غير صحيح" });
    return scriptOut_(e, {
      ok: true,
      summary: readSheet_("النتائج"),
      mistakes: readSheet_("الأخطاء")
    });
  }
  return ContentService.createTextOutput("كيف تستفيد المؤسسة من البيانات — الربط جاهز.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = readPayload_(e);
    if (String(data.kind || "") !== "org-data") throw new Error("unknown kind");
    var ss = openSheet_();
    writeSummary_(ss, data);
    var answers = asArray_(data.answers);
    if (answers.length && detailsAllowed_(ss, data)) writeDetails_(ss, data, answers);
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function detailsAllowed_(ss, data) {
  if (String(data.event || "") === "submit") return true;
  var sh = ss.getSheetByName("النتائج");
  if (!sh) return true;
  var row = findRow_(sh, data.sessionId);
  if (!row) return true;
  return String(sh.getRange(row, 4).getValue() || "") !== "أنهى";
}

function openSheet_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("اربط السكربت بالجدول");
  return ss;
}

function writeSummary_(ss, data) {
  var sh = ensureSheet_(ss, "النتائج", HEAD_SUMMARY);
  var existing = findRow_(sh, data.sessionId);
  if (existing && String(data.event || "") !== "submit") {
    var map = headerMap_(sh);
    var statusCol = map["الحالة"] || 4;
    var seenCol = map["آخر ظهور"] || 26;
    var status = String(sh.getRange(existing, statusCol).getValue() || "");
    if (status === "أنهى") {
      if (seenCol) sh.getRange(existing, seenCol).setValue(data.lastSeen || "");
      return;
    }
  }
  var row = summaryRow_(data);
  var target = existing || Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(target, 1, 1, row.length).setValues([row]);
}

function summaryRow_(data) {
  var finished = String(data.event || "") === "submit" || String(data.status || "") === "أنهى";
  return [
    data.sessionId || "",
    data.name || "",
    data.klass || "",
    data.status || "",
    finished ? (data.grade || "") : "",
    finished ? num_(data.score) : "",
    num_(data.total) || 50,
    finished ? num_(data.percent) : "",
    finished ? num_(data.correct) : "",
    finished ? num_(data.wrong) : "",
    finished ? num_(data.blank) : "",
    num_(data.answeredCount),
    num_(data.currentQuestion),
    data.examText || "",
    num_(data.examSeconds),
    data.studyText || "",
    num_(data.studySeconds),
    num_(data.readPercent),
    data.hiddenText || "",
    num_(data.hiddenSeconds),
    num_(data.clicks),
    num_(data.answerChanges),
    num_(data.backMoves),
    data.startedAt || "",
    finished ? (data.submittedAt || "") : "",
    data.lastSeen || "",
    finished ? (data.methodSplit || "") : ""
  ];
}

function writeDetails_(ss, data, answers) {
  var id = String(data.sessionId || "");
  var name = data.name || "";
  var klass = data.klass || "";
  var answerRows = [];
  var mistakeRows = [];
  for (var i = 0; i < answers.length; i++) {
    var a = answers[i] || {};
    var result = String(a.ok || "");
    answerRows.push([
      id, name, klass, num_(a.n), a.text || "",
      a.chosen || "", a.correct || "", result,
      num_(a.seconds), num_(a.clicks), num_(a.changes), a.why || ""
    ]);
    if (result === "خاطئة" || result === "بدون إجابة") {
      mistakeRows.push([
        id, name, klass, num_(a.n), a.text || "",
        a.chosen || "بدون إجابة", a.correct || "", result, a.why || ""
      ]);
    }
  }
  replaceRows_(ensureSheet_(ss, "الإجابات", HEAD_ANSWERS), id, answerRows);
  replaceRows_(ensureSheet_(ss, "الأخطاء", HEAD_MISTAKES), id, mistakeRows);

  var clicks = asArray_(data.clicksLog);
  var clickRows = [];
  for (var c = 0; c < clicks.length; c++) {
    var item = clicks[c] || {};
    clickRows.push([id, name, klass, num_(item.t), item.q || "", item.target || ""]);
  }
  replaceRows_(ensureSheet_(ss, "النقرات", HEAD_CLICKS), id, clickRows);
}

function replaceRows_(sh, sessionId, rows) {
  wipeSession_(sh, sessionId);
  if (!rows.length) return;
  var start = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

function wipeSession_(sh, sessionId) {
  var last = sh.getLastRow();
  if (last < 2 || !sessionId) return;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(sessionId)) sh.deleteRow(i + 2);
  }
}

function findRow_(sh, sessionId) {
  var last = sh.getLastRow();
  if (!sessionId || last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(sessionId)) return i + 2;
  }
  return 0;
}

function readSheet_(name) {
  var ss = openSheet_();
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var head = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < head.length; c++) {
      var value = values[i][c];
      if (value instanceof Date) value = Utilities.formatDate(value, "Asia/Amman", "yyyy/MM/dd HH:mm:ss");
      if (value !== "" && value != null) empty = false;
      obj[String(head[c])] = value == null ? "" : value;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    if (name === "النتائج") {
      var sheets = ss.getSheets();
      if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
        sh = sheets[0];
        sh.setName(name);
      }
    }
    if (!sh) sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold")
      .setBackground("#16324f")
      .setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.setColumnWidth(2, 180);
    sh.setColumnWidth(5, 140);
  }
  return sh;
}

function headerMap_(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, last).getValues()[0];
  var map = {};
  for (var i = 0; i < head.length; i++) map[String(head[i])] = i + 1;
  return map;
}

function keyOk_(e) {
  var sent = e && e.parameter ? String(e.parameter.key || "") : "";
  return sent && sent === String(TEACHER_KEY);
}

function num_(v) {
  if (v === "" || v == null) return 0;
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function asArray_(v) {
  if (Object.prototype.toString.call(v) === "[object Array]") return v;
  return [];
}

function scriptOut_(e, obj) {
  var body = JSON.stringify(obj);
  var cb = e && e.parameter ? String(e.parameter.callback || "") : "";
  if (cb && /^[A-Za-z0-9_]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOut_(obj);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function firstText_(v) {
  if (v == null) return "";
  if (Object.prototype.toString.call(v) === "[object Array]") v = v.length ? v[0] : "";
  return String(v);
}

function tryParseJson_(text) {
  if (!text) return null;
  try {
    var obj = JSON.parse(String(text).replace(/^\uFEFF/, "").trim());
    if (obj && typeof obj === "object") return obj;
  } catch (err) {}
  return null;
}

function tryParseForm_(text) {
  if (!text || text.indexOf("=") < 0) return null;
  var parts = String(text).split("&");
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf("=");
    if (eq < 0) continue;
    var key = parts[i].slice(0, eq);
    var val = parts[i].slice(eq + 1);
    try { key = decodeURIComponent(key.replace(/\+/g, " ")); } catch (e1) {}
    if (key !== "payload" && key !== "data") continue;
    try { val = decodeURIComponent(val.replace(/\+/g, " ")); } catch (e2) {}
    var parsed = tryParseJson_(val);
    if (parsed) return parsed;
  }
  return null;
}

function readPayload_(e) {
  e = e || {};
  var p = e.parameter || {};
  var ps = e.parameters || {};
  var raw = e.postData && e.postData.contents ? String(e.postData.contents) : "";
  var candidates = [p.payload, p.data, ps.payload, ps.data, raw];
  for (var i = 0; i < candidates.length; i++) {
    var text = firstText_(candidates[i]);
    if (!text) continue;
    var asJson = tryParseJson_(text);
    if (asJson) return asJson;
    var asForm = tryParseForm_(text);
    if (asForm) return asForm;
  }
  throw new Error("empty body");
}
