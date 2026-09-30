#!/usr/bin/env python3
"""
Full-application device QA.

Covers static routes, section/bottom tabs, safe button taps, and light form fills.
Stops before real payment, sign-out, and destructive deletes.
"""
from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adb_ui import (  # noqa: E402
    deep_link,
    dump_ui,
    find_edit_texts,
    find_nodes,
    keyevent,
    logcat_errors,
    parse_bounds,
    pid,
    shell,
    tap_bounds,
    tap_text,
    text_input,
    ui_summary,
)

OUT = Path("/tmp/device-qa/full-app.jsonl")
REPORT = Path("/tmp/device-qa/full-app-report.md")
REPO_REPORT = Path(__file__).resolve().parent / "FULL_APP_QA_REPORT.md"

# Destructive / money / session — never tap
BLOCK_TAP = {
    "sign out",
    "log out",
    "logout",
    "delete",
    "delete account",
    "remove account",
    "pay now",
    "pay",
    "confirm payment",
    "place order",
    "uninstall",
    "clear data",
    "factory reset",
    "block",
    "report and block",
    # Chrome / overlays that trap automation
    "search everywhere",
    "search listings",
    "search for anything",
    "search shops",
    "search people",
    "search jobs",
    "notifications (f8)",
    "notifications",
    "menu",
    "sheconomy ai",
    "ask about",
    "what to post",
    "close",
    "go back",
    "clear search",
}

# Prefer tapping these when present
PREFER_TAP = {
    "continue",
    "next",
    "save",
    "done",
    "apply",
    "filter",
    "sort",
    "search",
    "add",
    "create",
    "edit",
    "share",
    "view all",
    "see all",
    "retry",
    "browse",
    "shops",
    "favorites",
    "cart",
    "network",
    "post",
    "jobs",
    "groups",
    "calls",
    "video",
    "audio",
    "schedule",
    "meetings",
    "join",
    "account",
    "security",
    "appearance",
    "notifications",
    "privacy",
    "about",
}

ERROR_MARKERS = (
    "error on route",
    "usepushnotifications must be used",
    "usescreenzoom must be used",
    "view config getter",
    "must be a function (received",
    "something went wrong",
    "error boundary",
    "invariant violation",
)

SECTION_TABS = ["Home", "Community", "Chat", "Classes", "Class", "Co-Work"]

STATIC_ROUTES = [
    # Commerce
    "/",
    "/shops",
    "/favorites",
    "/cart",
    "/search",
    "/browse",
    "/browse/categories",
    "/browse/physical",
    "/browse/digital",
    "/orders",
    "/orders/success",
    "/addresses",
    "/payment-methods",
    "/checkout",
    "/following",
    "/create-my-shop",
    # Community
    "/community",
    "/community/network",
    "/community/create",
    "/community/jobs",
    "/community/jobs/create",
    "/community/groups",
    "/community/group/create",
    "/community/events",
    "/community/events/create",
    "/community/companies",
    "/community/company/create",
    "/community/stories",
    "/community/stories/create",
    "/community/saved",
    "/community/people",
    "/community/people/followers",
    "/community/people/following",
    "/community/analytics",
    # Chat
    "/chat",
    "/chat/groups",
    "/chat/calls",
    # Class
    "/class",
    "/class/video",
    "/class/audio",
    "/class/playlists",
    # Co-work
    "/co-work",
    "/co-work/schedule",
    "/co-work/meetings",
    "/co-work/join",
    # Account / settings / legal
    "/profile",
    "/notifications",
    "/settings",
    "/settings/account",
    "/settings/security",
    "/settings/appearance",
    "/settings/notifications",
    "/settings/privacy",
    "/settings/community",
    "/settings/commerce",
    "/settings/shop",
    "/settings/class",
    "/settings/co-work",
    "/settings/chat",
    "/settings/about",
    "/help",
    "/legal/terms",
    "/legal/privacy",
    "/legal/cookies",
    "/legal/ads",
    # Vendor
    "/vendor",
    "/vendor/myshop",
    "/vendor/myshop/edit",
    "/vendor/products",
    "/vendor/orders",
    "/vendor/analytics",
    "/vendor/delivery",
    "/vendor/ads",
    "/vendor/reviews",
    "/vendor/create-listing",
    "/vendor/settings",
    # Auth / misc
    "/auth/sign-in",
    "/auth/complete-profile",
    "/auth/import-contacts",
    "/auth/verify-gender",
    "/auth/qr",
    "/ui-kit",
    # Admin (role-gated expected)
    "/admin",
    "/admin/users",
    "/admin/products",
    "/admin/orders",
    "/admin/shops",
    "/admin/categories",
    "/admin/payments",
    "/admin/analytics",
    "/admin/cms",
    "/admin/blog",
    "/admin/settings",
    "/admin/cart",
    "/admin/sale-events",
    "/admin/company-pages",
    "/admin/groups",
]


def reopen_if_dead() -> bool:
    if pid():
        return True
    shell("am", "start", "-n", "com.sheconomy.ecommerce/.MainActivity", check=False)
    time.sleep(4)
    return bool(pid())


def navigate(path: str) -> None:
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


def collect_ui() -> tuple[list[str], list[dict]]:
    root = dump_ui()
    labels: list[str] = []
    clickables: list[dict] = []
    for n in root.iter("node"):
        t = n.attrib.get("text") or ""
        d = n.attrib.get("content-desc") or ""
        label = (d or t).strip()
        if t or d:
            labels.append(f"{t}|{d}")
        if n.attrib.get("clickable") == "true" and label:
            try:
                l, top, r, b = parse_bounds(n.attrib.get("bounds", "[0,0][0,0]"))
            except Exception:
                continue
            # Skip status bar / tiny
            if b < 80 or (r - l) < 24 or (b - top) < 24:
                continue
            clickables.append(
                {
                    "label": label,
                    "bounds": n.attrib["bounds"],
                    "y": top,
                    "text": t,
                    "desc": d,
                }
            )
    return labels, clickables


def classify(labels: list[str], path: str) -> str:
    blob = " | ".join(labels).lower()
    if any(m in blob for m in ERROR_MARKERS):
        return "error"
    if "sign in or create your account" in blob and "one-time" in blob:
        if path.startswith("/auth/"):
            return "ok"
        return "auth_wall"
    content = [
        (x.split("|")[0] or x.split("|")[1]).strip()
        for x in labels
        if (x.split("|")[0] or x.split("|")[1]).strip()
    ]
    chrome = {
        "notifications (f8)",
        "notifications",
        "menu",
        "home",
        "community",
        "chat",
        "classes",
        "co-work",
        "go back",
        "sheconomy home",
    }
    body = [c for c in content if c.lower() not in chrome]
    if len(body) < 2:
        return "blank"
    empty_markers = (
        "nothing here",
        "no results",
        "cart is empty",
        "no posts",
        "no orders",
        "no messages",
        "get started",
        "looks empty",
    )
    if any(m in blob for m in empty_markers):
        return "empty"
    return "ok"


def safe_to_tap(label: str) -> bool:
    low = label.lower().strip()
    if not low or len(low) > 60:
        return False
    if any(b in low for b in BLOCK_TAP):
        return False
    if low.startswith("search"):
        return False
    # Skip pure icons without useful names sometimes OK; skip numeric-only
    if re.fullmatch(r"[\d+.\s₹$%,/-]+", low):
        return False
    return True


def dismiss_overlays(times: int = 3) -> None:
    for _ in range(times):
        keyevent(4)
        time.sleep(0.25)


def pick_buttons(clickables: list[dict], limit: int = 6) -> list[dict]:
    scored: list[tuple[int, dict]] = []
    seen = set()
    for c in clickables:
        lab = c["label"]
        key = lab.lower()
        if key in seen or not safe_to_tap(lab):
            continue
        seen.add(key)
        score = 0
        for p in PREFER_TAP:
            if p in key:
                score += 5
        # Prefer mid-screen content over bottom chrome duplicates
        if 200 < c["y"] < 1900:
            score += 2
        scored.append((score, c))
    scored.sort(key=lambda x: (-x[0], x[1]["y"]))
    return [c for _, c in scored[:limit]]


def record(row: dict) -> None:
    with OUT.open("a") as f:
        f.write(json.dumps(row) + "\n")
    print(
        f"  {row.get('status')} {row.get('kind')} {row.get('path') or row.get('name')} "
        f"{(row.get('note') or '')[:80]}",
        flush=True,
    )


def visit_route(path: str) -> dict:
    logcat_errors(since_clear=True)
    dismiss_overlays(2)
    navigate(path)
    time.sleep(2.4)
    if not reopen_if_dead():
        row = {
            "type": "route",
            "path": path,
            "kind": "crash",
            "status": "FAIL",
            "note": "process dead",
            "buttons_tapped": [],
        }
        record(row)
        return row

    labels, clickables = collect_ui()
    kind = classify(labels, path)
    errs = logcat_errors()
    if errs and "lmkd" in errs.lower() and not pid():
        kind = "oom"
        reopen_if_dead()

    status = {
        "ok": "PASS",
        "empty": "WARN",
        "blank": "FAIL",
        "error": "FAIL",
        "auth_wall": "PASS" if path.startswith(("/auth", "/admin")) else "WARN",
        "oom": "FAIL",
        "crash": "FAIL",
    }.get(kind, "FAIL")

    # Role gate / access denied still process-alive PASS
    blob = " | ".join(labels).lower()
    if any(x in blob for x in ("access denied", "not authorized", "admins only", "vendor access")):
        status = "PASS"
        kind = "role_gated"

    sample = [
        (x.split("|")[0] or x.split("|")[1])[:60]
        for x in labels
        if (x.split("|")[0] or x.split("|")[1]).strip()
    ][:8]

    tapped: list[str] = []
    # Fewer taps; skip chrome-heavy screens
    targets = pick_buttons(clickables, limit=3 if kind in ("ok", "empty") else 0)
    for btn in targets:
        if not pid():
            reopen_if_dead()
            break
        try:
            tap_bounds(btn["bounds"])
            tapped.append(btn["label"][:40])
            time.sleep(1.0)
            if not pid():
                reopen_if_dead()
                kind = "oom"
                status = "FAIL"
                break
            dismiss_overlays(2)
            navigate(path)
            time.sleep(1.0)
        except Exception as e:
            tapped.append(f"ERR:{btn['label'][:20]}:{e}")

    # Light form fill (non-destructive)
    form_note = ""
    if kind in ("ok", "empty") and path not in ("/checkout",):
        edits = find_edit_texts()
        if edits and path in ("/search", "/community/create", "/community/jobs/create", "/co-work/join", "/help"):
            try:
                tap_bounds(edits[0].attrib["bounds"])
                time.sleep(0.2)
                text_input("qa test")
                time.sleep(0.4)
                form_note = "typed"
                dismiss_overlays(2)
            except Exception:
                form_note = "form_fail"

    row = {
        "type": "route",
        "path": path,
        "kind": kind,
        "status": status,
        "note": form_note,
        "buttons_found": len(clickables),
        "buttons_tapped": tapped,
        "sample": sample,
        "logcat": (errs[:160] if errs else ""),
    }
    record(row)
    return row


def exercise_section_tabs() -> list[dict]:
    rows = []
    navigate("/")
    time.sleep(2)
    for label in SECTION_TABS:
        if not reopen_if_dead():
            break
        ok = tap_text(label)
        time.sleep(2)
        labels, _ = collect_ui()
        kind = classify(labels, f"tab:{label}")
        status = "PASS" if kind in ("ok", "empty", "auth_wall") and pid() else "FAIL"
        if kind == "error":
            status = "FAIL"
        row = {
            "type": "section_tab",
            "path": f"tab:{label}",
            "kind": kind,
            "status": status,
            "note": f"tapped={ok}",
            "sample": [x.split("|")[0] for x in labels[:5]],
        }
        rows.append(row)
        record(row)
    return rows


def exercise_bottom_tabs() -> list[dict]:
    """Visit each section home and tap visible bottom-tab labels."""
    rows = []
    section_homes = {
        "commerce": "/",
        "community": "/community",
        "chat": "/chat",
        "class": "/class",
        "cowork": "/co-work",
    }
    for section, home in section_homes.items():
        if not reopen_if_dead():
            break
        navigate(home)
        time.sleep(2.5)
        _, clickables = collect_ui()
        # Bottom strip roughly y > 2100
        bottom = [c for c in clickables if c["y"] > 2050 and safe_to_tap(c["label"])]
        seen = set()
        for c in bottom[:6]:
            key = c["label"].lower()
            if key in seen:
                continue
            seen.add(key)
            tap_bounds(c["bounds"])
            time.sleep(1.5)
            alive = bool(pid())
            labels, _ = collect_ui()
            kind = classify(labels, home)
            row = {
                "type": "bottom_tab",
                "path": f"{section}:{c['label']}",
                "kind": kind if alive else "crash",
                "status": "PASS" if alive and kind != "error" else "FAIL",
                "note": "",
                "sample": [x.split("|")[0] for x in labels[:4]],
            }
            rows.append(row)
            record(row)
            navigate(home)
            time.sleep(1.0)
    return rows


def discover_dynamic() -> list[dict]:
    """Open a shop + listing from shops/home if available."""
    rows = []
    for start in ("/shops", "/"):
        if not reopen_if_dead():
            break
        navigate(start)
        time.sleep(2.5)
        labels, clickables = collect_ui()
        # Tap a mid-screen card-like control
        candidates = [
            c
            for c in clickables
            if 400 < c["y"] < 1700 and safe_to_tap(c["label"]) and len(c["label"]) > 3
        ]
        if not candidates:
            continue
        btn = candidates[0]
        tap_bounds(btn["bounds"])
        time.sleep(2.5)
        alive = bool(pid())
        labels2, clickables2 = collect_ui()
        kind = classify(labels2, start)
        row = {
            "type": "dynamic",
            "path": f"open_from:{start}",
            "kind": kind if alive else "crash",
            "status": "PASS" if alive and kind != "error" else "FAIL",
            "note": f"tapped={btn['label'][:40]}",
            "buttons_tapped": [btn["label"][:40]],
            "sample": [x.split("|")[0] for x in labels2[:6]],
        }
        rows.append(row)
        record(row)

        # If listing-like, try Add to cart (safe) then leave checkout alone
        for lab in ("Add to cart", "Add to Cart", "View shop", "Follow"):
            if tap_text(lab):
                time.sleep(1.2)
                rows.append(
                    {
                        "type": "dynamic_cta",
                        "path": f"cta:{lab}",
                        "kind": "ok" if pid() else "crash",
                        "status": "PASS" if pid() else "FAIL",
                        "note": "",
                    }
                )
                record(rows[-1])
                break
        keyevent(4)
        time.sleep(0.8)
    return rows


def form_suite() -> list[dict]:
    rows = []
    # Search
    navigate("/search")
    time.sleep(2)
    edits = find_edit_texts()
    if edits:
        tap_bounds(edits[0].attrib["bounds"])
        text_input("saree")
        keyevent(66)
        time.sleep(2)
        rows.append(
            {
                "type": "form",
                "path": "form:search",
                "kind": "ok" if pid() else "crash",
                "status": "PASS" if pid() else "FAIL",
                "note": "query=saree",
            }
        )
    else:
        rows.append(
            {
                "type": "form",
                "path": "form:search",
                "kind": "blank",
                "status": "FAIL",
                "note": "no field",
            }
        )
    record(rows[-1])

    # Composer
    navigate("/community/create")
    time.sleep(2)
    edits = find_edit_texts()
    if edits:
        tap_bounds(edits[0].attrib["bounds"])
        text_input("QA draft do not publish")
        time.sleep(0.5)
        keyevent(4)
        rows.append(
            {
                "type": "form",
                "path": "form:composer",
                "kind": "ok" if pid() else "crash",
                "status": "PASS" if pid() else "FAIL",
                "note": "draft typed, not published",
            }
        )
    else:
        # try Post tab
        navigate("/community")
        time.sleep(1)
        tap_text("Post") or tap_text("Create")
        time.sleep(1.5)
        edits = find_edit_texts()
        rows.append(
            {
                "type": "form",
                "path": "form:composer",
                "kind": "ok" if edits else "blank",
                "status": "PASS" if pid() else "FAIL",
                "note": f"edits={len(edits)}",
            }
        )
    record(rows[-1])

    # Checkout open only
    navigate("/checkout")
    time.sleep(2)
    labels, _ = collect_ui()
    kind = classify(labels, "/checkout")
    rows.append(
        {
            "type": "form",
            "path": "form:checkout_open",
            "kind": kind,
            "status": "PASS" if pid() and kind != "error" else "FAIL",
            "note": "no payment submitted",
        }
    )
    record(rows[-1])

    # Join meeting code field
    navigate("/co-work/join")
    time.sleep(2)
    edits = find_edit_texts()
    if edits:
        tap_bounds(edits[0].attrib["bounds"])
        text_input("QAJOIN")
        keyevent(4)
    rows.append(
        {
            "type": "form",
            "path": "form:cowork_join",
            "kind": "ok" if pid() else "crash",
            "status": "PASS" if pid() else "FAIL",
            "note": f"edits={len(edits)}",
        }
    )
    record(rows[-1])
    return rows


def write_report(rows: list[dict]) -> None:
    counts = Counter(r.get("status") for r in rows)
    kinds = Counter(r.get("kind") for r in rows)
    lines = [
        "# Full application device QA report",
        "",
        "Device: SM_G781B / release `com.sheconomy.ecommerce`",
        "Scope: static routes, section tabs, bottom tabs, safe buttons, key forms",
        "Excluded: real PayU charge, Sign out, Delete account, meeting media stress",
        "",
        f"**Totals:** PASS={counts.get('PASS',0)} WARN={counts.get('WARN',0)} FAIL={counts.get('FAIL',0)} (n={len(rows)})",
        f"**Kinds:** {dict(kinds)}",
        "",
        "## Failures",
        "",
        "| Type | Route | Kind | Notes | Sample |",
        "|------|-------|------|-------|--------|",
    ]
    fails = [r for r in rows if r.get("status") == "FAIL"]
    if not fails:
        lines.append("| — | — | none | — | — |")
    else:
        for r in fails:
            sample = "; ".join(r.get("sample") or [])[:80].replace("|", "/")
            note = (r.get("note") or "").replace("|", "/")[:80]
            lines.append(
                f"| {r.get('type')} | `{r.get('path')}` | {r.get('kind')} | {note} | {sample} |"
            )

    lines += [
        "",
        "## Warnings",
        "",
        "| Type | Route | Kind | Notes |",
        "|------|-------|------|-------|",
    ]
    warns = [r for r in rows if r.get("status") == "WARN"]
    if not warns:
        lines.append("| — | — | none | — |")
    else:
        for r in warns:
            note = (r.get("note") or "").replace("|", "/")[:80]
            lines.append(
                f"| {r.get('type')} | `{r.get('path')}` | {r.get('kind')} | {note} |"
            )

    lines += [
        "",
        "## Full matrix",
        "",
        "| Status | Type | Route | Kind | Buttons tapped |",
        "|--------|------|-------|------|----------------|",
    ]
    for r in rows:
        tapped = ", ".join(r.get("buttons_tapped") or [])[:60].replace("|", "/")
        lines.append(
            f"| {r.get('status')} | {r.get('type')} | `{r.get('path')}` | {r.get('kind')} | {tapped} |"
        )

    text = "\n".join(lines) + "\n"
    REPORT.write_text(text)
    REPO_REPORT.write_text(text)
    print(text)


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    if not reopen_if_dead():
        print("App will not start")
        return 2

    rows: list[dict] = []
    print("== section tabs ==", flush=True)
    rows += exercise_section_tabs()
    print("== bottom tabs ==", flush=True)
    rows += exercise_bottom_tabs()
    print("== static routes ==", flush=True)
    for path in STATIC_ROUTES:
        rows.append(visit_route(path))
    print("== dynamic discovery ==", flush=True)
    rows += discover_dynamic()
    print("== forms ==", flush=True)
    rows += form_suite()

    write_report(rows)
    fails = sum(1 for r in rows if r.get("status") == "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
