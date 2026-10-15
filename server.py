# -*- coding: utf-8 -*-
"""يخدم الصفحة ويكتب النتائج في results.xls من غير أي رسالة للطالبة."""
import json
import os
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
STORE = ROOT / "results-data.json"
OUT = ROOT / "results.xls"
LOCK = threading.Lock()

SUMMARY = [
    "الاسم", "الشعبة", "الحالة", "التقدير", "الدرجة", "من", "النسبة",
    "الصحيحة", "الخاطئة", "غير المجاب", "مدة الاختبار", "عدد النقرات",
    "تغييرات الإجابة", "مرات الرجوع", "بداية", "التسليم", "آخر ظهور", "تفصيل التصنيف"
]


def xml_escape(value):
    text = "" if value is None else str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def cell(value):
    return '<Cell><Data ss:Type="String">%s</Data></Cell>' % xml_escape(value)


def worksheet(name, rows):
    body = "".join("<Row>%s</Row>" % "".join(cell(item) for item in row) for row in rows)
    return '<Worksheet ss:Name="%s"><Table>%s</Table></Worksheet>' % (xml_escape(name), body)


def load_store():
    if not STORE.exists():
        return {}
    try:
        data = json.loads(STORE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def summary_row(pack):
    return [
        pack.get("name") or "",
        pack.get("klass") or "",
        pack.get("status") or "",
        pack.get("grade") or "",
        pack.get("score") if pack.get("score") != "" else "",
        pack.get("total") or "",
        pack.get("percent") if pack.get("percent") != "" else "",
        pack.get("correct") if pack.get("correct") != "" else "",
        pack.get("wrong") if pack.get("wrong") != "" else "",
        pack.get("blank") if pack.get("blank") != "" else "",
        pack.get("examText") or "",
        pack.get("clicks") or 0,
        pack.get("answerChanges") or 0,
        pack.get("backMoves") or 0,
        pack.get("startedAt") or "",
        pack.get("submittedAt") or "",
        pack.get("lastSeen") or "",
        pack.get("methodSplit") or "",
    ]


def write_xls(packs):
    ordered = sorted(packs.values(), key=lambda item: (item.get("lastSeen") or "", item.get("name") or ""))
    summary = [SUMMARY]
    answers = [["الاسم", "الشعبة", "رقم السؤال", "السؤال", "إجابة الطالبة", "الصحيح", "النتيجة", "السبب"]]
    mistakes = [["الاسم", "الشعبة", "رقم السؤال", "السؤال", "إجابة الطالبة", "الصحيح", "السبب"]]
    for pack in ordered:
        summary.append(summary_row(pack))
        for row in pack.get("answers") or []:
            line = [
                pack.get("name") or "",
                pack.get("klass") or "",
                row.get("n") or "",
                row.get("text") or "",
                row.get("chosen") or "",
                row.get("correct") or "",
                row.get("ok") or "",
                row.get("why") or "",
            ]
            answers.append(line)
            if row.get("ok") != "صحيحة":
                mistakes.append([
                    pack.get("name") or "",
                    pack.get("klass") or "",
                    row.get("n") or "",
                    row.get("text") or "",
                    row.get("chosen") or "",
                    row.get("correct") or "",
                    row.get("why") or "",
                ])
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?mso-application progid="Excel.Sheet"?>\n'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        + worksheet("النتائج", summary)
        + worksheet("الإجابات", answers)
        + worksheet("الأخطاء", mistakes)
        + "</Workbook>"
    )
    OUT.write_text(xml, encoding="utf-8-sig")


def merge(pack):
    sid = str(pack.get("sessionId") or "").strip()
    if not sid:
        return
    with LOCK:
        data = load_store()
        old = data.get(sid) or {}
        if old.get("status") == "أنهى" and pack.get("status") != "أنهى":
            old["lastSeen"] = pack.get("lastSeen") or old.get("lastSeen")
            pack = old
        elif old.get("answers") and not pack.get("answers"):
            pack["answers"] = old.get("answers")
        data[sid] = pack
        STORE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        write_xls(data)


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if urlparse(self.path).path != "/save":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            pack = json.loads(raw.decode("utf-8"))
        except (UnicodeError, ValueError):
            self.send_response(400)
            self.end_headers()
            return
        if isinstance(pack, dict):
            merge(pack)
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("0.0.0.0", 8761), Handler).serve_forever()
