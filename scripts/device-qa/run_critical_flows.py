#!/usr/bin/env python3
"""Traverse critical routes on device; record pass/fail."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adb_ui import (  # noqa: E402
    deep_link,
    dump_ui,
    find_edit_texts,
    find_nodes,
    keyevent,
    logcat_errors,
    pid,
    shell,
    tap_bounds,
    tap_text,
    text_input,
    ui_summary,
)

OUT = Path("/tmp/device-qa/results.jsonl")
REPORT = Path("/tmp/device-qa/report.md")

ROUTES = [
    # Commerce
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
    # Community
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
    # Chat
    ("chat/home", "/chat"),
    ("chat/groups", "/chat/groups"),
    ("chat/calls", "/chat/calls"),
    # Class
    ("class/home", "/class"),
    ("class/video", "/class/video"),
    ("class/audio", "/class/audio"),
    ("class/playlists", "/class/playlists"),
    # Co-work
    ("cowork/home", "/co-work"),
    ("cowork/schedule", "/co-work/schedule"),
    ("cowork/meetings", "/co-work/meetings"),
    ("cowork/join", "/co-work/join"),
    # Account
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
    # Misc
    ("help", "/help"),
    ("legal/terms", "/legal/terms"),
    ("legal/privacy", "/legal/privacy"),
    # Vendor (role-gated ok)
    ("vendor/home", "/vendor"),
    ("vendor/myshop", "/vendor/myshop"),
]


def check_alive() -> tuple[bool, str]:
    p = pid()
    if not p:
        return False, "process_dead"
    return True, p


def classify_ui(labels: list[str]) -> str:
    blob = " | ".join(labels).lower()
    if "sign in" in blob and "email" in blob and "one-time" in blob:
        return "auth_wall"
    if any(
        x in blob
        for x in (
            "something went wrong",
            "error boundary",
            "error on route",
            "usepushnotifications must be used",
            "try again",
        )
    ):
        return "error_ui"
    if len(labels) < 3:
        return "sparse_ui"
    return "ok"


def visit(name: str, path: str) -> dict:
    logcat_errors(since_clear=True)
    deep_link(path.lstrip("/") if path != "/" else "")
    if path == "/":
        # sheconomy:// alone may not work — use root explicitly
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
    time.sleep(2.5)
    alive, p = check_alive()
    if not alive:
        return {"name": name, "path": path, "status": "FAIL", "note": "process died", "pid": p}

    dump_ui()
    labels = []
    for n in find_nodes():
        t = n.attrib.get("text") or ""
        d = n.attrib.get("content-desc") or ""
        if t or d:
            labels.append(f"{t}|{d}")
    kind = classify_ui(labels)
    errs = logcat_errors()
    status = "PASS"
    note = kind
    blob = " | ".join(labels).lower()
    role_gated = any(
        k in blob
        for k in (
            "access denied",
            "not authorized",
            "vendor access",
            "become a seller",
            "create a shop",
            "you need a shop",
            "permission",
            "only vendors",
        )
    )
    if kind == "error_ui":
        status = "FAIL"
    elif kind == "auth_wall":
        status = "FAIL"
        note = "auth_wall (expected signed-in session)"
    elif name.startswith("vendor/") and (role_gated or kind == "ok"):
        # Role gate or vendor UI both acceptable for non-vendor accounts
        status = "PASS"
        note = "role_gated_or_vendor_ui" if role_gated else kind
    elif kind == "sparse_ui":
        status = "WARN"
    if errs:
        status = "FAIL"
        note = f"{note}; logcat={errs[:200]}"
    # Sample texts for debugging
    sample = [x for x in labels if x.split("|")[0]][:8]
    return {
        "name": name,
        "path": path,
        "status": status,
        "note": note,
        "pid": p,
        "sample": sample,
    }


def form_search() -> dict:
    deep_link("search")
    time.sleep(2)
    dump_ui()
    edits = find_edit_texts()
    if not edits:
        return {"name": "form/search", "status": "FAIL", "note": "no search field"}
    tap_bounds(edits[0].attrib["bounds"])
    time.sleep(0.3)
    text_input("saree")
    keyevent(66)  # ENTER
    time.sleep(2.5)
    alive, _ = check_alive()
    dump_ui()
    labels = ui_summary()
    return {
        "name": "form/search",
        "status": "PASS" if alive else "FAIL",
        "note": f"query=saree; labels={len(labels)}",
        "sample": labels[:6],
    }


def form_cart_checkout() -> list[dict]:
    results = []
    # Try open a shop then listing if possible
    deep_link("shops")
    time.sleep(2)
    dump_ui()
    # Tap first shop-like text (skip filters)
    clicked = False
    for n in find_nodes():
        t = n.attrib.get("text") or ""
        if len(t) > 3 and t not in ("All shops", "Filter shops", "Sort by", "Country", "Following"):
            if n.attrib.get("clickable") == "true" or True:
                # Prefer shop cards mid-screen
                b = n.attrib.get("bounds", "")
                if ",1" in b or True:
                    try:
                        from adb_ui import parse_bounds

                        l, t0, r, b0 = parse_bounds(b)
                        if t0 > 500 and t0 < 1800 and (r - l) > 200:
                            tap_bounds(b)
                            clicked = True
                            break
                    except Exception:
                        pass
    time.sleep(2)
    results.append(
        {
            "name": "form/open_shop_or_listing",
            "status": "PASS" if pid() else "FAIL",
            "note": f"clicked={clicked}",
        }
    )

    # Look for Add to cart / Buy
    dump_ui()
    for label in ("Add to cart", "Add to Cart", "Buy now", "Buy Now", "Add"):
        if tap_text(label):
            time.sleep(1.5)
            results.append({"name": "form/add_to_cart", "status": "PASS", "note": label})
            break
    else:
        results.append({"name": "form/add_to_cart", "status": "WARN", "note": "no CTA found"})

    deep_link("cart")
    time.sleep(2)
    results.append(
        {
            "name": "form/cart",
            "status": "PASS" if pid() else "FAIL",
            "note": classify_ui(ui_summary()),
        }
    )
    deep_link("checkout")
    time.sleep(2)
    dump_ui()
    # Do NOT tap Pay
    results.append(
        {
            "name": "form/checkout_open",
            "status": "PASS" if pid() else "FAIL",
            "note": "stopped before payment; " + classify_ui(ui_summary()),
            "sample": ui_summary()[:8],
        }
    )
    return results


def form_composer() -> dict:
    deep_link("community/create")
    time.sleep(2.5)
    dump_ui()
    edits = find_edit_texts()
    if edits:
        tap_bounds(edits[0].attrib["bounds"])
        text_input("Device QA draft post - ignore")
        time.sleep(0.5)
        # Dismiss without publish if possible
        keyevent(4)  # BACK
        time.sleep(1)
        return {
            "name": "form/composer",
            "status": "PASS" if pid() else "FAIL",
            "note": "typed draft; back",
        }
    # Maybe overlay composer via community home Post tab
    deep_link("community")
    time.sleep(1.5)
    tap_text("Post") or tap_text("Create")
    time.sleep(2)
    edits = find_edit_texts()
    note = f"edits={len(edits)}"
    if edits:
        tap_bounds(edits[0].attrib["bounds"])
        text_input("Device QA draft")
        keyevent(4)
    return {
        "name": "form/composer",
        "status": "PASS" if pid() else "FAIL",
        "note": note,
        "sample": ui_summary()[:8],
    }


def form_settings_toggles() -> dict:
    deep_link("settings/appearance")
    time.sleep(2)
    dump_ui()
    # Tap something that looks like a switch/theme without committing destructive changes
    tapped = tap_text("Light") or tap_text("Dark") or tap_text("System")
    time.sleep(1)
    return {
        "name": "form/settings_appearance",
        "status": "PASS" if pid() else "FAIL",
        "note": f"tapped_theme={tapped}",
        "sample": ui_summary()[:8],
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    results: list[dict] = []

    print("== route traversal ==")
    for name, path in ROUTES:
        print(f"  visit {name} {path}")
        r = visit(name, path)
        results.append(r)
        with OUT.open("a") as f:
            f.write(json.dumps(r) + "\n")
        print(f"    -> {r['status']} {r['note']}")
        if r["status"] == "FAIL" and "process died" in r["note"]:
            shell("am", "start", "-n", "com.sheconomy.ecommerce/.MainActivity", check=False)
            time.sleep(3)

    print("== key forms ==")
    for r in [form_search(), *form_cart_checkout(), form_composer(), form_settings_toggles()]:
        results.append(r)
        with OUT.open("a") as f:
            f.write(json.dumps(r) + "\n")
        print(f"  {r['name']} -> {r['status']} {r.get('note')}")

    # Write markdown report
    lines = [
        "# Device critical-flows QA report",
        "",
        f"Device: RZCT80X8MVA / com.sheconomy.ecommerce",
        f"Auth: sanjeev.shukla@bioayurveda.in (OTP auto-read)",
        "",
        "| Status | Route | Notes |",
        "|--------|-------|-------|",
    ]
    counts = {"PASS": 0, "FAIL": 0, "WARN": 0}
    for r in results:
        st = r.get("status", "?")
        counts[st] = counts.get(st, 0) + 1
        path = r.get("path") or r.get("name")
        note = (r.get("note") or "").replace("|", "/")
        lines.append(f"| {st} | `{path}` | {note} |")
    lines += [
        "",
        f"**Totals:** PASS={counts.get('PASS',0)} WARN={counts.get('WARN',0)} FAIL={counts.get('FAIL',0)}",
        "",
    ]
    REPORT.write_text("\n".join(lines))
    print(REPORT.read_text())
    return 0 if counts.get("FAIL", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
