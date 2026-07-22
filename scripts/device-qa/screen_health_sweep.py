#!/usr/bin/env python3
"""Screen health sweep: classify complete / empty / blank / error UIs on device."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adb_ui import (  # noqa: E402
    deep_link,
    dump_ui,
    find_nodes,
    logcat_errors,
    parse_bounds,
    pid,
    shell,
    ui_summary,
)

OUT = Path("/tmp/device-qa/screen-health.jsonl")
REPORT = Path("/tmp/device-qa/screen-health-report.md")
REPO_REPORT = Path(__file__).resolve().parent / "SCREEN_HEALTH_REPORT.md"

# Chrome-only labels that do not count as screen content
CHROME = {
    "notifications (f8)",
    "notifications",
    "menu",
    "go back",
    "home",
    "shops",
    "favorites",
    "cart",
    "you",
    "sign in",
    "create",
    "store",
    "community",
    "chat",
    "classes",
    "co-work",
    "network",
    "post",
    "jobs",
    "chats",
    "groups",
    "calls",
    "video",
    "audio",
    "schedule",
    "meetings",
    "join",
    "sheconomy home",
    "search for anything",
    "search listings",
    "search shops",
}

ERROR_MARKERS = (
    "something went wrong",
    "error boundary",
    "error on route",
    "usepushnotifications must be used",
    "must be used within",
    "uncaught",
    "javascriptexception",
    "render error",
    "typeerror",
    "referenceerror",
    "cannot read propert",
    "is not a function",
    "failed to load",
    "network request failed",
)

EMPTY_MARKERS = (
    "nothing here",
    "no results",
    "no items",
    "no posts",
    "no listings",
    "no shops",
    "no orders",
    "no messages",
    "no chats",
    "no calls",
    "no events",
    "no jobs",
    "no groups",
    "no stories",
    "no saved",
    "no favorites",
    "no addresses",
    "no payment",
    "empty cart",
    "cart is empty",
    "you haven't",
    "you haven\u2019t",
    "get started",
    "be the first",
    "when you",
    "looks empty",
    "no content",
)

LOADING_MARKERS = ("loading", "please wait", "fetching")

ROUTES = [
    ("commerce/home", "/"),
    ("commerce/shops", "/shops"),
    ("commerce/favorites", "/favorites"),
    ("commerce/cart", "/cart"),
    ("commerce/search", "/search"),
    ("commerce/browse_categories", "/browse/categories"),
    ("commerce/orders", "/orders"),
    ("commerce/addresses", "/addresses"),
    ("commerce/payment_methods", "/payment-methods"),
    ("commerce/checkout", "/checkout"),
    ("commerce/following", "/following"),
    ("community/home", "/community"),
    ("community/network", "/community/network"),
    ("community/create", "/community/create"),
    ("community/jobs", "/community/jobs"),
    ("community/groups", "/community/groups"),
    ("community/events", "/community/events"),
    ("community/companies", "/community/companies"),
    ("community/stories", "/community/stories"),
    ("community/saved", "/community/saved"),
    ("community/people", "/community/people"),
    ("chat/home", "/chat"),
    ("chat/groups", "/chat/groups"),
    ("chat/calls", "/chat/calls"),
    ("class/home", "/class"),
    ("class/video", "/class/video"),
    ("class/audio", "/class/audio"),
    ("class/playlists", "/class/playlists"),
    ("cowork/home", "/co-work"),
    ("cowork/schedule", "/co-work/schedule"),
    ("cowork/meetings", "/co-work/meetings"),
    ("cowork/join", "/co-work/join"),
    ("account/profile", "/profile"),
    ("account/notifications", "/notifications"),
    ("account/settings", "/settings"),
    ("account/settings_account", "/settings/account"),
    ("account/settings_security", "/settings/security"),
    ("account/settings_appearance", "/settings/appearance"),
    ("account/settings_notifications", "/settings/notifications"),
    ("account/settings_privacy", "/settings/privacy"),
    ("account/settings_community", "/settings/community"),
    ("account/settings_commerce", "/settings/commerce"),
    ("account/settings_shop", "/settings/shop"),
    ("account/settings_class", "/settings/class"),
    ("account/settings_co_work", "/settings/co-work"),
    ("account/settings_about", "/settings/about"),
    ("help", "/help"),
    ("legal/terms", "/legal/terms"),
    ("legal/privacy", "/legal/privacy"),
    ("vendor/home", "/vendor"),
    ("vendor/myshop", "/vendor/myshop"),
    ("auth/sign-in", "/auth/sign-in"),
]


def content_labels(raw: list[str]) -> list[str]:
    out = []
    for item in raw:
        text, _, desc = item.partition("|")
        # ui_summary format is text|desc|[bounds] from some helpers; visit uses text|desc
        label = (text or desc).strip()
        if not label:
            continue
        # drop bounds suffix if present
        label = re.sub(r"\[.*?\]$", "", label).strip()
        if not label:
            continue
        if label.lower() in CHROME:
            continue
        if label.lower() in {"99+", "1", "2", "3", "4", "5"}:
            continue
        out.append(label)
    return out


def classify(raw_labels: list[str], content: list[str]) -> tuple[str, str]:
    """Return (kind, detail). kind in complete|empty|blank|error|auth_wall|loading."""
    blob = " | ".join(raw_labels).lower()
    content_blob = " | ".join(content).lower()

    if "sign in or create your account" in blob and "one-time" in blob:
        # Expected only on auth/sign-in
        return "auth_wall", "sign-in gate"

    for m in ERROR_MARKERS:
        if m in blob:
            return "error", m

    # Explicit Retry + Error pattern
    if "retry" in blob and ("error" in blob or "exception" in blob):
        return "error", "retry+error"

    if any(m in content_blob for m in EMPTY_MARKERS):
        return "empty", "intentional empty state"

    if len(content) <= 1 and any(m in blob for m in LOADING_MARKERS):
        return "loading", "loading-only"

    if len(content) < 2:
        return "blank", f"content_labels={len(content)}"

    # Mostly chrome with tiny content
    if len(content) < 4 and len(raw_labels) < 10:
        return "blank", f"sparse content={len(content)} raw={len(raw_labels)}"

    return "complete", f"content={len(content)}"


def visit(name: str, path: str) -> dict:
    logcat_errors(since_clear=True)
    if path == "/":
        shell(
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            "sheconomy:///",
            "com.sheconomy.ecommerce",
            check=False,
        )
    else:
        deep_link(path.lstrip("/"))
    time.sleep(3.0)

    p = pid()
    if not p:
        return {
            "name": name,
            "path": path,
            "kind": "crash",
            "status": "FAIL",
            "note": "process dead",
            "pid": "",
            "content_n": 0,
            "sample": [],
        }

    root = dump_ui()
    raw = []
    nodes = 0
    for n in root.iter("node"):
        nodes += 1
        t = n.attrib.get("text") or ""
        d = n.attrib.get("content-desc") or ""
        if t or d:
            raw.append(f"{t}|{d}")

    content = content_labels(raw)
    kind, detail = classify(raw, content)
    # auth/sign-in expecting auth_wall → complete for that route
    if path == "/auth/sign-in" and kind == "auth_wall":
        kind = "complete"
        detail = "expected sign-in screen"

    errs = logcat_errors()
    status = {
        "complete": "PASS",
        "empty": "WARN",  # intentional empty is ok but flagged
        "blank": "FAIL",
        "error": "FAIL",
        "auth_wall": "FAIL",  # unexpected when signed in
        "loading": "WARN",
        "crash": "FAIL",
    }.get(kind, "FAIL")

    if errs and "lmkd" in errs.lower():
        status = "FAIL"
        kind = "crash"
        detail = "lmkd OOM; " + detail
    elif errs and kind == "complete":
        status = "WARN"
        detail = detail + "; logcat_noise"

    sample = content[:8] if content else [x.split("|")[0] or x.split("|")[1] for x in raw[:6]]
    return {
        "name": name,
        "path": path,
        "kind": kind,
        "status": status,
        "note": detail,
        "pid": p,
        "nodes": nodes,
        "content_n": len(content),
        "sample": sample,
        "logcat": (errs[:240] if errs else ""),
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    if not pid():
        shell("am", "start", "-n", "com.sheconomy.ecommerce/.MainActivity", check=False)
        time.sleep(4)

    results: list[dict] = []
    print("== screen health sweep ==")
    for name, path in ROUTES:
        print(f"  {path} ...", flush=True)
        r = visit(name, path)
        results.append(r)
        with OUT.open("a") as f:
            f.write(json.dumps(r) + "\n")
        print(f"    -> {r['status']} {r['kind']} ({r['note']}) content={r['content_n']}", flush=True)
        if r["kind"] == "crash" and not pid():
            shell("am", "start", "-n", "com.sheconomy.ecommerce/.MainActivity", check=False)
            time.sleep(4)

    # Report
    by_kind: dict[str, list[dict]] = {}
    for r in results:
        by_kind.setdefault(r["kind"], []).append(r)

    lines = [
        "# Screen health report (blank / empty / error / complete)",
        "",
        "Device: SM_G781B (`RZCT80X8MVA`) / release `com.sheconomy.ecommerce`",
        "Focus: detect **complete**, **empty**, **blank**, and **error** screens after signed-in session.",
        "",
        f"- complete: {len(by_kind.get('complete', []))}",
        f"- empty (intentional): {len(by_kind.get('empty', []))}",
        f"- blank: {len(by_kind.get('blank', []))}",
        f"- error: {len(by_kind.get('error', []))}",
        f"- auth_wall (unexpected): {len(by_kind.get('auth_wall', []))}",
        f"- loading: {len(by_kind.get('loading', []))}",
        f"- crash: {len(by_kind.get('crash', []))}",
        "",
        "## Problems (blank / error / crash / unexpected auth)",
        "",
        "| Kind | Route | Notes | Sample |",
        "|------|-------|-------|--------|",
    ]
    problems = [
        r
        for r in results
        if r["kind"] in ("blank", "error", "crash", "auth_wall")
        or r["status"] == "FAIL"
    ]
    if not problems:
        lines.append("| — | — | none | — |")
    else:
        for r in problems:
            sample = "; ".join((r.get("sample") or [])[:3]).replace("|", "/")[:100]
            note = (r.get("note") or "").replace("|", "/")[:120]
            lines.append(f"| {r['kind']} | `{r['path']}` | {note} | {sample} |")

    lines += [
        "",
        "## Empty states (OK if intentional)",
        "",
        "| Route | Notes | Sample |",
        "|-------|-------|--------|",
    ]
    empties = by_kind.get("empty", [])
    if not empties:
        lines.append("| — | none detected | — |")
    else:
        for r in empties:
            sample = "; ".join((r.get("sample") or [])[:3]).replace("|", "/")[:100]
            lines.append(f"| `{r['path']}` | {r.get('note','')} | {sample} |")

    lines += [
        "",
        "## Full matrix",
        "",
        "| Status | Kind | Route | Content# | Notes |",
        "|--------|------|-------|----------|-------|",
    ]
    for r in results:
        note = (r.get("note") or "").replace("|", "/")[:100]
        lines.append(
            f"| {r['status']} | {r['kind']} | `{r['path']}` | {r.get('content_n',0)} | {note} |"
        )

    lines += ["", f"Artifacts: `{OUT}`, `{REPORT}`", ""]
    text = "\n".join(lines)
    REPORT.write_text(text)
    REPO_REPORT.write_text(text)
    print(text)
    fails = sum(1 for r in results if r["status"] == "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
