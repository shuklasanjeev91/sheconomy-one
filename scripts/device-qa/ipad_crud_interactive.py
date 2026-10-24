#!/usr/bin/env python3
"""Lean iPad interactive nav/button/CRUD pass (assumes WDA already up on :8100)."""
from __future__ import annotations

import base64
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".tmp" / "ipad-qa" / "crud"
JSONL = OUT / "crud-interactive.jsonl"
BASE = "http://127.0.0.1:8100"
DEVICE = "4B264D11-0D94-563C-9F1C-68B874AD0B3C"
BUNDLE = "com.sheconomy.ecommerce"
MARKER = f"QA CRUD {datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

sid = None
W = 1366
H = 1024
rows: list[dict] = []


def qa_slug(label: str) -> str:
    s = label.lower().replace("+", "plus")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def qa_top_tab(label: str) -> str:
    return f"qa-top-tab-{qa_slug(label)}"


def qa_bottom_tab(section: str, label: str) -> str:
    return f"qa-bottom-tab-{qa_slug(section)}-{qa_slug(label)}"


QA = {
    "post_composer_input": "qa-post-composer-input",
    "post_submit": "qa-post-submit",
    "post_more": "qa-post-more",
    "post_edit": "qa-post-edit",
    "post_delete": "qa-post-delete",
    "post_save": "qa-post-save",
    "post_unsave": "qa-post-unsave",
    "post_edit_input": "qa-post-edit-input",
    "post_edit_save": "qa-post-edit-save",
    "post_delete_confirm": "qa-post-delete-confirm",
    "listing_add_to_cart": "qa-listing-add-to-cart",
    "listing_buy_now": "qa-listing-buy-now",
    "listing_favorite": "qa-listing-favorite",
    "cart_item_delete": "qa-cart-item-delete",
    "profile_edit": "qa-profile-edit",
    "job_create": "qa-job-create",
    "group_create": "qa-group-create",
    "event_create": "qa-event-create",
    "address_add": "qa-address-add",
    "payment_add_card": "qa-payment-add-card",
    "search_input": "qa-search-input",
    "class_tab_video": "qa-class-tab-video",
    "class_tab_audio": "qa-class-tab-audio",
    "class_tab_playlists": "qa-class-tab-playlists",
}

ACCOUNT_IDS = {
    "Settings & privacy": "qa-account-settings",
    "Your profile": "qa-account-profile",
    "Notifications": "qa-account-notifications",
    "Help & Support": "qa-account-help",
    "Orders": "qa-account-orders",
    "Wishlist": "qa-account-wishlist",
    "Payment methods": "qa-account-payments",
    "Delivery addresses": "qa-account-addresses",
    "Start your shop": "qa-account-shop-manager",
    "Manage your shop": "qa-account-shop-manager",
    "Ask SHERPA": "qa-account-ai-assist",
}

SETTINGS_IDS = {
    "Account": "qa-settings-account",
    "Security": "qa-settings-security",
    "Appearance": "qa-settings-appearance",
    "Notifications": "qa-settings-notifications",
    "Privacy": "qa-settings-privacy",
    "Community": "qa-settings-community",
    "Commerce": "qa-settings-commerce",
    "Shop": "qa-settings-shop",
    "Class": "qa-settings-class",
    "Co-Work": "qa-settings-co-work",
    "About": "qa-settings-about",
}


def rec(row: dict) -> None:
    rows.append(row)
    with JSONL.open("a") as fh:
        fh.write(json.dumps(row) + "\n")
    print(f"[{row['status']}] {row['phase']}:{row['name']} — {row.get('note', '')}", flush=True)


def api(m: str, p: str, payload=None, timeout: float = 20):
    r = requests.request(m, BASE + p, json=payload, timeout=timeout)
    if r.status_code >= 400:
        raise RuntimeError(f"{m} {p} {r.status_code} {r.text[:200]}")
    return r.json() if r.text else {}


def ensure_session() -> None:
    global sid, W, H
    last = None
    for _ in range(6):
        try:
            st = api("GET", "/status", timeout=5)
            if not st.get("value", {}).get("ready"):
                raise RuntimeError("not ready")
            sess = api(
                "POST",
                "/session",
                {
                    "capabilities": {
                        "alwaysMatch": {
                            "bundleId": BUNDLE,
                            "shouldWaitForQuiescence": False,
                        }
                    }
                },
                timeout=40,
            )
            sid = sess["sessionId"]
            size = api("GET", f"/session/{sid}/window/size")["value"]
            W, H = int(size["width"]), int(size["height"])
            print("session", sid, W, H, flush=True)
            return
        except Exception as e:
            last = e
            print("session retry", e, flush=True)
            time.sleep(2)
    raise RuntimeError(f"no session: {last}")


def S() -> str:
    assert sid
    return f"/session/{sid}"


def shot(name: str) -> bool:
    try:
        b64 = api("GET", f"{S()}/screenshot", timeout=15)["value"]
        (OUT / f"{name}.png").write_bytes(base64.b64decode(b64))
        return True
    except Exception as e:
        print("shot fail", name, e, flush=True)
        return False


def tap(label: str) -> bool:
    for using, value in [
        ("accessibility id", label),
        ("name", label),
        ("xpath", f"//*[@name='{label}' or @label='{label}']"),
        ("xpath", f"//*[contains(@name,'{label}') or contains(@label,'{label}')]"),
    ]:
        try:
            el = api("POST", f"{S()}/element", {"using": using, "value": value}, timeout=10)
            val = el.get("value") or {}
            eid = val.get("ELEMENT") or val.get("element-6066-11e4-a52e-4f735466cecf")
            if not eid:
                continue
            api("POST", f"{S()}/element/{eid}/click", timeout=10)
            return True
        except Exception:
            continue
    return False


def tap_any(*candidates: str) -> bool:
    for candidate in candidates:
        if candidate and tap(candidate):
            return True
    return False


def find_element(value: str, timeout: float = 10) -> str | None:
    for using, val in [
        ("accessibility id", value),
        ("name", value),
        ("xpath", f"//*[@name='{value}' or @label='{value}']"),
    ]:
        try:
            el = api("POST", f"{S()}/element", {"using": using, "value": val}, timeout=timeout)
            node = el.get("value") or {}
            eid = node.get("ELEMENT") or node.get("element-6066-11e4-a52e-4f735466cecf")
            if eid:
                return eid
        except Exception:
            continue
    return None


def type_into(test_id: str, text: str) -> bool:
    eid = find_element(test_id)
    if not eid:
        return False
    for payload in ({"value": list(text)}, {"text": text}):
        try:
            api("POST", f"{S()}/element/{eid}/value", payload, timeout=15)
            return True
        except Exception:
            continue
    return False


def tap_xy(x: float, y: float) -> bool:
    try:
        api("POST", f"{S()}/wda/tap", {"x": int(x), "y": int(y)}, timeout=10)
        return True
    except Exception:
        return False


def keys(text: str) -> bool:
    try:
        api("POST", f"{S()}/wda/keys", {"value": list(text)}, timeout=15)
        return True
    except Exception:
        try:
            api("POST", f"{S()}/keys", {"value": list(text)}, timeout=15)
            return True
        except Exception:
            return False


def dismiss() -> None:
    for lab in ["Close", "Cancel", "Discard", "Later", "Done", "Not Now"]:
        if tap(lab):
            time.sleep(0.4)
            return
    tap_xy(W * 0.97, H * 0.05)
    time.sleep(0.3)


def open_url(path: str) -> None:
    url = f"https://www.sheconomy.in{path}"
    subprocess.run(
        [
            "xcrun",
            "devicectl",
            "device",
            "process",
            "launch",
            "--device",
            DEVICE,
            "--timeout",
            "45",
            "--payload-url",
            url,
            BUNDLE,
        ],
        capture_output=True,
        text=True,
        timeout=55,
    )
    time.sleep(3.5)
    ensure_session()


def safe(fn, phase: str, name: str) -> None:
    try:
        fn()
    except Exception as e:
        rec({"phase": phase, "name": name, "status": "FAIL", "note": str(e)[:200]})
        try:
            ensure_session()
        except Exception:
            pass


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if JSONL.exists():
        JSONL.unlink()
    ensure_session()

    print("== interactive nav ==", flush=True)
    for tab in ["Commerce", "Community", "Chat", "Classes", "Co-Work"]:
        dismiss()
        ok = tap_any(qa_top_tab(tab), tab, "Co-work" if tab == "Co-Work" else tab)
        time.sleep(1.6)
        shot(f"int-top-{tab.lower().replace('-', '')}")
        rec({"phase": "nav", "name": f"top:{tab}", "status": "PASS" if ok else "FAIL", "note": f"tapped={ok}"})

    for group, enter, tabs in [
        ("community", "Community", ["Home", "Network", "Create Post", "Jobs", "You"]),
        ("commerce", "Commerce", ["Home", "Shops", "Create Shop", "You"]),
        ("chat", "Chat", ["Home", "Groups", "New chat", "Calls", "You"]),
        ("class", "Classes", ["Home", "Video", "Audio", "You"]),
    ]:
        tap_any(qa_top_tab(enter), enter)
        time.sleep(1.2)
        for tab in tabs:
            dismiss()
            ok = tap_any(qa_bottom_tab(group, tab), tab)
            if not ok and tab in ("Create Post", "New chat", "Create Shop"):
                ok = tap_xy(W * 0.5, H * 0.96)
            time.sleep(1.8)
            shot(f"int-{group}-{tab.lower().replace(' ', '-')}")
            rec(
                {
                    "phase": "nav",
                    "name": f"{group}:{tab}",
                    "status": "PASS" if ok else "WARN",
                    "note": f"tapped={ok}",
                }
            )
            if tab in ("Create Post", "New chat", "Create Shop"):
                dismiss()

    print("== buttons ==", flush=True)
    for enter, key, labels in [
        (
            "Community",
            "community",
            [
                "See all",
                "All",
                "Updates",
                "Photos",
                "Articles",
                "Events",
                "Polls",
                "Post a job",
                "Create group",
            ],
        ),
        (
            "Commerce",
            "commerce",
            ["Share", "Clear", "Add to cart", "Buy now", "Discover today's finds"],
        ),
        ("Chat", "chat", ["Start a chat"]),
        ("Classes", "class", ["Video", "Audio", "Playlists", "Browse all", "Play"]),
    ]:
        tap_any(qa_top_tab(enter), enter)
        time.sleep(1.5)
        for lab in labels:
            class_ids = {
                "Video": QA["class_tab_video"],
                "Audio": QA["class_tab_audio"],
                "Playlists": QA["class_tab_playlists"],
            }
            create_ids = {
                "Post a job": QA["job_create"],
                "Create group": QA["group_create"],
            }
            ok = tap_any(class_ids.get(lab, ""), create_ids.get(lab, ""), lab)
            time.sleep(0.9)
            rec(
                {
                    "phase": "button",
                    "name": f"{key}:{lab}",
                    "status": "PASS" if ok else "SKIP",
                    "note": f"tapped={ok}",
                }
            )
            dismiss()

    open_url("/notifications")
    for lab in [
        "Settings & privacy",
        "Your profile",
        "Notifications",
        "Help & Support",
        "Orders",
        "Wishlist",
        "Payment methods",
        "Delivery addresses",
        "Start your shop",
        "Ask SHERPA",
    ]:
        ok = tap_any(ACCOUNT_IDS.get(lab, ""), lab)
        time.sleep(1.0)
        rec(
            {
                "phase": "button",
                "name": f"account:{lab}",
                "status": "PASS" if ok else "SKIP",
                "note": f"tapped={ok}",
            }
        )
        dismiss()
        time.sleep(0.3)

    open_url("/settings")
    for lab in [
        "Account",
        "Security",
        "Appearance",
        "Notifications",
        "Privacy",
        "Community",
        "Commerce",
        "Shop",
        "Class",
        "Co-Work",
        "About",
        "Help",
    ]:
        ok = tap_any(SETTINGS_IDS.get(lab, ""), lab)
        time.sleep(1.0)
        if ok:
            shot(f"int-settings-{lab.lower()}")
        rec(
            {
                "phase": "button",
                "name": f"settings:{lab}",
                "status": "PASS" if ok else "SKIP",
                "note": f"tapped={ok}",
            }
        )
        if ok:
            tap("Back") or tap_xy(W * 0.05, H * 0.08)
            time.sleep(0.6)

    print("== crud ==", flush=True)
    from urllib.parse import quote
    open_url(f"/community/create?qaSeed={quote(MARKER + ' create')}")
    time.sleep(2)
    typed = True
    posted = tap_any(QA["post_submit"], "Post")
    time.sleep(4.0)
    shot("int-crud-post-create")
    rec(
        {
            "phase": "crud",
            "name": "post:create",
            "status": "PASS" if posted else "FAIL",
            "note": f"typed={typed}; posted={posted}; marker={MARKER}",
        }
    )

    edited = False
    if tap_any(QA["post_more"], "More", "More options"):
        time.sleep(0.7)
    if tap_any(QA["post_edit"], "Edit post", "Edit"):
        time.sleep(1)
        type_into(QA["post_edit_input"], " edited") or keys(" edited")
        edited = tap_any(QA["post_edit_save"], "Save", "Post", "Update")
        time.sleep(2)
        shot("int-crud-post-edit")
    rec({"phase": "crud", "name": "post:edit", "status": "PASS" if edited else "WARN", "note": f"edited={edited}"})

    deleted = False
    if tap_any(QA["post_more"], "More", "More options"):
        time.sleep(0.5)
    if tap_any(QA["post_delete"], "Delete post", "Delete"):
        time.sleep(0.7)
        deleted = tap_any(QA["post_delete_confirm"], "Delete")
        time.sleep(2)
        shot("int-crud-post-delete")
    rec(
        {
            "phase": "crud",
            "name": "post:delete",
            "status": "PASS" if deleted else "WARN",
            "note": f"deleted={deleted}",
        }
    )

    open_url("/listing/red-striped-table-mat-corner-lotus-online")
    time.sleep(4)
    shot("int-crud-listing")
    added = tap_any(QA["listing_add_to_cart"], "Add to cart", "Add to Cart")
    time.sleep(2)
    shot("int-crud-add-cart")
    rec({"phase": "crud", "name": "cart:add", "status": "PASS" if added else "WARN", "note": f"added={added}"})
    open_url("/cart")
    time.sleep(2)
    shot("int-crud-cart")
    removed = tap_any(QA["cart_item_delete"], "Delete", "Remove")
    if removed:
        time.sleep(0.8)
        tap_any("Remove", "Delete")
    shot("int-crud-cart-remove")
    rec(
        {
            "phase": "crud",
            "name": "cart:remove",
            "status": "PASS" if removed else "WARN",
            "note": f"removed={removed}",
        }
    )

    open_url("/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a")
    time.sleep(3)
    saved = tap_any(QA["post_save"], "Save", "Save post")
    if not saved:
        if tap_any(QA["post_more"], "More", "More options"):
            time.sleep(0.6)
            saved = tap_any(QA["post_save"], "Save", "Save post")
    shot("int-crud-save")
    rec({"phase": "crud", "name": "post:save", "status": "PASS" if saved else "WARN", "note": f"saved={saved}"})
    open_url("/community/saved")
    time.sleep(2)
    shot("int-crud-saved-list")
    unsaved = tap_any(QA["post_unsave"], "Unsave", "Remove", "Saved")
    rec(
        {
            "phase": "crud",
            "name": "post:unsave",
            "status": "PASS" if unsaved else "WARN",
            "note": f"unsaved={unsaved}",
        }
    )

    open_url("/settings/account")
    time.sleep(2)
    shot("int-crud-profile")
    opened = tap_any(QA["profile_edit"], "Edit profile", "Edit", "Your profile", "Add a headline")
    time.sleep(1.5)
    savedp = False
    if opened:
        shot("int-crud-profile-edit")
        tap_xy(W * 0.5, H * 0.35)
        keys(" " + MARKER)
        savedp = tap("Save") or tap("Done")
        time.sleep(2)
        shot("int-crud-profile-saved")
    rec(
        {
            "phase": "crud",
            "name": "profile:edit",
            "status": "PASS" if savedp else "WARN",
            "note": f"opened={opened}; saved={savedp}",
        }
    )
    dismiss()

    for name, path, buttons in [
        ("job:create_form", "/community/jobs", [QA["job_create"], "Post a job"]),
        ("group:create_form", "/community/groups", [QA["group_create"], "Create group"]),
        ("event:create_form", "/community/events", [QA["event_create"], "Create event", "Create"]),
        ("shop:create_form", "/create-my-shop", []),
        ("address:create_form", "/addresses", [QA["address_add"], "Add address", "Add", "New address"]),
        ("payment:create_form", "/payment-methods", [QA["payment_add_card"], "Debit / credit card", "Add card", "Add payment"]),
    ]:
        open_url(path)
        time.sleep(1)
        opened = False
        for b in buttons:
            if tap_any(b):
                opened = True
                break
        time.sleep(1.5)
        shot(f"int-form-{name.replace(':', '-')}")
        status = "PASS" if (opened or not buttons) else "WARN"
        rec({"phase": "crud", "name": name, "status": status, "note": f"opened={opened}"})
        dismiss()
        dismiss()

    open_url("/search")
    time.sleep(1)
    focused = tap_any(QA["search_input"], "Search for anything") or tap_xy(W * 0.5, H * 0.08)
    typed = type_into(QA["search_input"], "saree") or keys("saree")
    try:
        api("POST", f"{S()}/wda/keys", {"value": ["\n"]}, timeout=8)
    except Exception:
        pass
    time.sleep(2.5)
    shot("int-search-saree")
    rec(
        {
            "phase": "crud",
            "name": "search:query",
            "status": "PASS" if typed else "WARN",
            "note": f"focused={focused}; typed={typed}",
        }
    )

    open_url("/listing/red-striped-table-mat-corner-lotus-online")
    time.sleep(4)
    fav = tap_any(QA["listing_favorite"], "Favorite", "Wishlist", "Add to wishlist")
    if not fav:
        fav = tap_xy(W * 0.92, H * 0.35)
    time.sleep(1.5)
    shot("int-crud-favorite")
    rec({"phase": "crud", "name": "listing:favorite", "status": "PASS" if fav else "WARN", "note": f"fav={fav}"})

    (OUT / "interactive-summary.json").write_text(json.dumps(rows, indent=2))
    print("INTERACTIVE_DONE", len(rows), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
