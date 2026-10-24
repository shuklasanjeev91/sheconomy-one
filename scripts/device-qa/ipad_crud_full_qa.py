#!/usr/bin/env python3
"""
iPad full feature + CRUD QA.

Phase A — every major route via deep-link + DVT screenshot + syslog crash check
Phase B — WDA: every top/bottom tab + primary CTA buttons
Phase C — WDA CRUD: post create/edit/delete, cart add/remove, save/unsave,
          profile edit, create-form opens, search

Evidence: .tmp/ipad-qa/crud/
"""
from __future__ import annotations

import base64
import json
import os
import statistics
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".tmp" / "ipad-qa" / "crud"
REPORT = OUT / "IPAD_CRUD_FULL_QA_REPORT.md"
JSONL = OUT / "results.jsonl"

DEVICE = "4B264D11-0D94-563C-9F1C-68B874AD0B3C"
BUNDLE = "com.sheconomy.ecommerce"
WDA_BUNDLE = "com.sheconomy.WebDriverAgentRunner.xctrunner"
BASE = os.environ.get("WDA_URL", "http://127.0.0.1:8100")
MARKER = f"QA CRUD {datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
VENV_PY = ROOT / ".tmp" / "device-qa-venv" / "bin" / "python"

ROUTES: list[tuple[str, str]] = [
    ("store/home", "/"),
    ("store/shops", "/shops"),
    ("store/favorites", "/favorites"),
    ("store/cart", "/cart"),
    ("store/search", "/search"),
    ("store/browse_categories", "/browse/categories"),
    ("store/orders", "/orders"),
    ("store/addresses", "/addresses"),
    ("store/payment_methods", "/payment-methods"),
    ("store/following", "/following"),
    ("store/checkout", "/checkout"),
    ("store/listing", "/listing/red-striped-table-mat-corner-lotus-online"),
    ("store/shop", "/shop/sidscreation"),
    ("store/category", "/category/fashion"),
    ("store/create_shop", "/create-my-shop"),
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
    ("community/analytics", "/community/analytics"),
    ("community/post", "/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a"),
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
    ("account/help", "/help"),
    ("legal/terms", "/legal/terms"),
    ("legal/privacy", "/legal/privacy"),
    ("vendor/home", "/vendor"),
    ("vendor/myshop", "/vendor/myshop"),
    ("vendor/products", "/vendor/products"),
    ("vendor/orders", "/vendor/orders"),
    ("blog/home", "/blog"),
    ("creator/hub", "/u/yoreb96930"),
]

TOP_TABS = ["Commerce", "Community", "Chat", "Classes", "Co-Work"]
NAV_GROUPS = [
    ("community", "Community", ["Home", "Network", "Create", "Jobs", "You"]),
    ("commerce", "Commerce", ["Home", "Shops", "Create Shop", "You"]),
    ("chat", "Chat", ["Home", "Groups", "New chat", "Calls", "You"]),
    ("class", "Classes", ["Home", "Video", "Audio", "You"]),
]

SURFACE_CTAS = {
    "community": [
        "Continue", "Later", "Complete profile", "See all", "All", "Updates",
        "Photos", "Articles", "Events", "Celebrations", "Polls", "Post a job",
        "Create group", "Create event",
    ],
    "commerce": [
        "Continue", "Later", "Share", "Clear", "Discover today's finds",
        "Add to cart", "Buy now", "Follow shop",
    ],
    "chat": ["Start a chat", "Continue", "Later"],
    "class": ["Video", "Audio", "Playlists", "Browse all", "Play"],
    "account": [
        "Settings & privacy", "Your profile", "Notifications", "Help & Support",
        "Ask SHERPA", "Payment methods", "Delivery addresses",
        "Start your shop", "Orders", "Wishlist",
    ],
}


def run(cmd: list[str], timeout: float = 90) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)


def app_alive() -> bool:
    r = run(
        ["xcrun", "devicectl", "device", "info", "processes", "--device", DEVICE, "--timeout", "30"],
        timeout=40,
    )
    return "SHEconomy.app/SHEconomy" in (r.stdout or "")


def open_url(path: str) -> bool:
    url = f"https://www.sheconomy.in{path}"
    r = run(
        [
            "xcrun", "devicectl", "device", "process", "launch",
            "--device", DEVICE, "--timeout", "45",
            "--payload-url", url, BUNDLE,
        ],
        timeout=55,
    )
    out = (r.stdout or "") + (r.stderr or "")
    return r.returncode == 0 and "Launched application" in out


def dvt_shot(dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        dest.unlink()
    r = run(
        [str(VENV_PY), "-m", "pymobiledevice3", "developer", "dvt", "screenshot", str(dest)],
        timeout=60,
    )
    return dest.exists() and dest.stat().st_size > 40_000


def classify_png(path: Path) -> str:
    try:
        from PIL import Image

        im = Image.open(path).convert("RGB")
        w, h = im.size
        samples = [im.getpixel((x, y)) for y in range(0, h, max(1, h // 24)) for x in range(0, w, max(1, w // 24))]
        avg = tuple(sum(c[i] for c in samples) / len(samples) for i in range(3))
        lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in samples]
        var = statistics.pvariance(lum) if len(lum) > 1 else 0
        if var < 30 and avg[0] > 240 and avg[1] > 240 and avg[2] > 240:
            return "blank_white"
        if var < 40:
            return "low_variance"
        return "ok"
    except Exception:
        return "ok" if path.stat().st_size > 80_000 else "tiny"


def ensure_wda() -> None:
    run(["pkill", "-f", "iproxy 8100"], timeout=10)
    time.sleep(0.3)
    subprocess.Popen(["iproxy", "8100", "8100"], stdout=open("/tmp/iproxy-crud.log", "w"), stderr=subprocess.STDOUT)
    time.sleep(1)
    try:
        r = requests.get(f"{BASE}/status", timeout=3)
        if r.ok and r.json().get("value", {}).get("ready"):
            return
    except Exception:
        pass

    run(["pkill", "-f", "dvt xcuitest"], timeout=10)
    time.sleep(0.5)
    run(
        ["xcrun", "devicectl", "device", "process", "launch", "--device", DEVICE, "--timeout", "45", BUNDLE],
        timeout=55,
    )
    subprocess.Popen(
        ["pymobiledevice3", "developer", "dvt", "xcuitest", WDA_BUNDLE, "--timeout", "1800"],
        stdout=open("/tmp/wda-crud.log", "w"),
        stderr=subprocess.STDOUT,
    )
    for _ in range(24):
        time.sleep(2)
        run(["pkill", "-f", "iproxy 8100"], timeout=10)
        time.sleep(0.2)
        subprocess.Popen(["iproxy", "8100", "8100"], stdout=open("/tmp/iproxy-crud.log", "w"), stderr=subprocess.STDOUT)
        time.sleep(1)
        try:
            r = requests.get(f"{BASE}/status", timeout=3)
            if r.ok and r.json().get("value", {}).get("ready"):
                return
        except Exception:
            continue
    raise RuntimeError("WDA not ready")


class Wda:
    def __init__(self) -> None:
        self.sid: str | None = None
        self.w = 1366
        self.h = 1024

    def api(self, method: str, path: str, payload=None, timeout: float = 30):
        r = requests.request(method, BASE + path, json=payload, timeout=timeout)
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:250]}")
        return r.json() if r.text else {}

    def alive(self) -> bool:
        try:
            r = requests.get(f"{BASE}/status", timeout=3)
            return bool(r.ok and r.json().get("value", {}).get("ready"))
        except Exception:
            return False

    def start(self) -> None:
        if not self.alive():
            ensure_wda()
        sess = self.api(
            "POST",
            "/session",
            {"capabilities": {"alwaysMatch": {"bundleId": BUNDLE, "shouldWaitForQuiescence": False}}},
        )
        self.sid = sess["sessionId"]
        size = self.api("GET", f"/session/{self.sid}/window/size")["value"]
        self.w, self.h = int(size["width"]), int(size["height"])

    def recover(self) -> None:
        try:
            if self.sid:
                requests.delete(f"{BASE}/session/{self.sid}", timeout=5)
        except Exception:
            pass
        self.sid = None
        ensure_wda()
        self.start()

    def ensure(self) -> None:
        if not self.alive() or not self.sid:
            self.recover()
            return
        try:
            self.api("GET", f"/session/{self.sid}/window/size", timeout=8)
        except Exception:
            self.recover()

    @property
    def S(self) -> str:
        assert self.sid
        return f"/session/{self.sid}"

    def shot(self, name: str) -> Path:
        self.ensure()
        try:
            b64 = self.api("GET", f"{self.S}/screenshot", timeout=20)["value"]
            path = OUT / f"{name}.png"
            path.write_bytes(base64.b64decode(b64))
            return path
        except Exception:
            # fallback DVT
            path = OUT / f"{name}.png"
            dvt_shot(path)
            return path

    def labels(self) -> list[str]:
        self.ensure()
        xml = self.api("GET", f"{self.S}/source", timeout=25)["value"]
        out: list[str] = []
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            return out
        for el in root.iter():
            for attr in ("name", "label", "value"):
                v = el.attrib.get(attr)
                if v and v.strip() and v not in out and len(v) < 80:
                    out.append(v.strip())
        return out

    def classify_labels(self, labels: list[str]) -> str:
        blob = " | ".join(labels).lower()
        if any(x in blob for x in ("something went wrong", "error boundary", "error on route")):
            return "error_ui"
        if "sign in" in blob and ("email" in blob or "one-time" in blob):
            return "auth_wall"
        if len(labels) < 4:
            return "sparse_ui"
        return "ok"

    def tap_text(self, label: str) -> bool:
        self.ensure()
        for using, value in [
            ("accessibility id", label),
            ("name", label),
            ("xpath", f"//*[@name='{label}' or @label='{label}']"),
            ("xpath", f"//*[contains(@name,'{label}') or contains(@label,'{label}')]"),
        ]:
            try:
                el = self.api("POST", f"{self.S}/element", {"using": using, "value": value}, timeout=12)
                val = el.get("value") or {}
                eid = val.get("ELEMENT") or val.get("element-6066-11e4-a52e-4f735466cecf")
                if not eid:
                    continue
                self.api("POST", f"{self.S}/element/{eid}/click", timeout=12)
                return True
            except Exception:
                continue
        return False

    def tap_xy(self, x: float, y: float) -> bool:
        self.ensure()
        try:
            self.api("POST", f"{self.S}/wda/tap", {"x": int(x), "y": int(y)}, timeout=12)
            return True
        except Exception:
            return False

    def type_text(self, text: str) -> bool:
        self.ensure()
        try:
            self.api("POST", f"{self.S}/wda/keys", {"value": list(text)}, timeout=15)
            return True
        except Exception:
            try:
                self.api("POST", f"{self.S}/keys", {"value": list(text)}, timeout=15)
                return True
            except Exception:
                return False

    def dismiss(self) -> None:
        for lab in ["Close", "Cancel", "Discard", "Not Now", "Later", "Done", "No thanks"]:
            if self.tap_text(lab):
                time.sleep(0.4)
                return
        self.tap_xy(self.w * 0.97, self.h * 0.05)
        time.sleep(0.3)

    def stop(self) -> None:
        if self.sid:
            try:
                requests.delete(f"{BASE}/session/{self.sid}", timeout=5)
            except Exception:
                pass


def rec(fh, rows: list, row: dict) -> None:
    rows.append(row)
    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    fh.flush()
    print(f"[{row['status']}] {row['phase']}:{row['name']} — {row.get('note','')}", flush=True)


def phase_routes(fh, rows: list) -> None:
    print("== phase A: routes (deep-link + DVT) ==", flush=True)
    # cold launch
    run(
        ["xcrun", "devicectl", "device", "process", "launch", "--device", DEVICE, "--timeout", "45", BUNDLE],
        timeout=55,
    )
    time.sleep(2)
    for name, path in ROUTES:
        launched = open_url(path)
        time.sleep(5.5)
        alive = app_alive()
        shot = OUT / f"route-{name.replace('/', '-')}.png"
        got = dvt_shot(shot)
        visual = classify_png(shot) if got else "missing"
        status = "PASS"
        if not alive:
            status = "FAIL"
        elif visual in ("blank_white", "tiny", "missing"):
            status = "WARN"
        elif not launched:
            status = "WARN"
        rec(
            fh,
            rows,
            {
                "phase": "route",
                "name": name,
                "path": path,
                "status": status,
                "note": f"launch={launched}; alive={alive}; visual={visual}; bytes={shot.stat().st_size if got else 0}",
            },
        )


def phase_nav_and_buttons(w: Wda, fh, rows: list) -> None:
    print("== phase B: tabs + buttons (WDA) ==", flush=True)
    w.ensure()

    for tab in TOP_TABS:
        try:
            w.dismiss()
            ok = w.tap_text(tab) or (tab == "Co-Work" and w.tap_text("Co-work"))
            time.sleep(2.0)
            labels = w.labels()
            w.shot(f"tab-top-{tab.lower().replace('-', '')}")
            kind = w.classify_labels(labels)
            status = "PASS" if ok and kind != "error_ui" else ("WARN" if ok else "FAIL")
            rec(fh, rows, {"phase": "nav", "name": f"top:{tab}", "status": status, "note": f"tapped={ok}; kind={kind}"})
        except Exception as e:
            rec(fh, rows, {"phase": "nav", "name": f"top:{tab}", "status": "FAIL", "note": str(e)})
            w.recover()

    for group, enter, tabs in NAV_GROUPS:
        try:
            w.tap_text(enter)
            time.sleep(1.4)
        except Exception:
            w.recover()
            w.tap_text(enter)
            time.sleep(1.4)
        for tab in tabs:
            try:
                w.dismiss()
                ok = w.tap_text(tab)
                if not ok and tab in ("Create", "New chat", "Create Shop"):
                    ok = w.tap_xy(w.w * 0.5, w.h * 0.96)
                time.sleep(2.0)
                labels = w.labels()
                w.shot(f"tab-{group}-{tab.lower().replace(' ', '-')}")
                kind = w.classify_labels(labels)
                status = "PASS" if ok and kind != "error_ui" else ("WARN" if ok else "FAIL")
                rec(
                    fh,
                    rows,
                    {
                        "phase": "nav",
                        "name": f"{group}:{tab}",
                        "status": status,
                        "note": f"tapped={ok}; kind={kind}",
                    },
                )
                if "Create" in tab or tab == "New chat":
                    w.dismiss()
            except Exception as e:
                rec(fh, rows, {"phase": "nav", "name": f"{group}:{tab}", "status": "FAIL", "note": str(e)})
                w.recover()

    for enter, key, path in [
        ("Community", "community", "/community"),
        ("Commerce", "commerce", "/"),
        ("Chat", "chat", "/chat"),
        ("Classes", "class", "/class"),
        ("You", "account", "/notifications"),
    ]:
        open_url(path)
        time.sleep(3.5)
        w.recover()  # deep-link can drop WDA
        if enter in TOP_TABS:
            w.tap_text(enter)
            time.sleep(1.0)
        for label in SURFACE_CTAS[key]:
            try:
                ok = w.tap_text(label)
                time.sleep(1.0)
                labels = w.labels()
                kind = w.classify_labels(labels)
                if not ok:
                    status = "SKIP"
                elif kind == "error_ui":
                    status = "FAIL"
                else:
                    status = "PASS"
                rec(
                    fh,
                    rows,
                    {
                        "phase": "button",
                        "name": f"{key}:{label}",
                        "status": status,
                        "note": f"tapped={ok}; kind={kind}",
                    },
                )
                w.dismiss()
            except Exception as e:
                rec(fh, rows, {"phase": "button", "name": f"{key}:{label}", "status": "FAIL", "note": str(e)})
                w.recover()


def phase_crud(w: Wda, fh, rows: list) -> None:
    print("== phase C: CRUD ==", flush=True)

    # --- Post create / edit / delete ---
    try:
        open_url("/community/create")
        time.sleep(3.5)
        w.recover()
        if "Create a post" not in " ".join(w.labels()):
            w.tap_text("Community")
            time.sleep(1)
            w.tap_text("Create") or w.tap_xy(w.w * 0.5, w.h * 0.96)
            time.sleep(2)
        composer = w.tap_text("What do you want to talk about?")
        if not composer:
            w.tap_xy(w.w * 0.5, w.h * 0.35)
        typed = w.type_text(MARKER + " create")
        posted = w.tap_text("Post")
        time.sleep(4.5)
        w.shot("crud-post-after-create")
        rec(
            fh,
            rows,
            {
                "phase": "crud",
                "name": "post:create",
                "status": "PASS" if posted else "FAIL",
                "note": f"composer={composer}; typed={typed}; posted={posted}; marker={MARKER}",
            },
        )

        edited = False
        for lab in ["More", "More options", "•••", "..."]:
            if w.tap_text(lab):
                time.sleep(0.8)
                break
        if w.tap_text("Edit post") or w.tap_text("Edit"):
            time.sleep(1.2)
            w.type_text(" edited")
            edited = w.tap_text("Save") or w.tap_text("Post") or w.tap_text("Update")
            time.sleep(2.5)
            w.shot("crud-post-after-edit")
        rec(fh, rows, {"phase": "crud", "name": "post:edit", "status": "PASS" if edited else "WARN", "note": f"edited={edited}"})

        deleted = False
        for lab in ["More", "More options", "•••", "..."]:
            w.tap_text(lab)
            time.sleep(0.5)
        if w.tap_text("Delete post") or w.tap_text("Delete"):
            time.sleep(0.8)
            deleted = w.tap_text("Delete")
            time.sleep(2.0)
            w.shot("crud-post-after-delete")
        rec(fh, rows, {"phase": "crud", "name": "post:delete", "status": "PASS" if deleted else "WARN", "note": f"deleted={deleted}"})
    except Exception as e:
        rec(fh, rows, {"phase": "crud", "name": "post:flow", "status": "FAIL", "note": str(e)})
        w.recover()

    # --- Cart add / remove ---
    try:
        open_url("/listing/red-striped-table-mat-corner-lotus-online")
        time.sleep(7.0)
        w.recover()
        w.shot("crud-listing")
        added = w.tap_text("Add to cart") or w.tap_text("Add to Cart")
        time.sleep(2.0)
        w.shot("crud-after-add-cart")
        rec(fh, rows, {"phase": "crud", "name": "cart:add", "status": "PASS" if added else "WARN", "note": f"added={added}"})
        open_url("/cart")
        time.sleep(4.0)
        w.recover()
        w.shot("crud-cart")
        removed = False
        for lab in ["Remove", "Delete", "Clear", "−"]:
            if w.tap_text(lab):
                time.sleep(1)
                w.tap_text("Remove") or w.tap_text("Delete")
                removed = True
                break
        w.shot("crud-cart-after-remove")
        rec(fh, rows, {"phase": "crud", "name": "cart:remove", "status": "PASS" if removed else "WARN", "note": f"removed={removed}"})
    except Exception as e:
        rec(fh, rows, {"phase": "crud", "name": "cart:flow", "status": "FAIL", "note": str(e)})
        w.recover()

    # --- Save / unsave ---
    try:
        open_url("/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a")
        time.sleep(5.0)
        w.recover()
        saved = w.tap_text("Save") or w.tap_text("Save post")
        if not saved:
            for lab in ["More", "More options", "•••"]:
                if w.tap_text(lab):
                    time.sleep(0.7)
                    saved = w.tap_text("Save") or w.tap_text("Save post")
                    break
        w.shot("crud-post-saved")
        rec(fh, rows, {"phase": "crud", "name": "post:save", "status": "PASS" if saved else "WARN", "note": f"saved={saved}"})
        open_url("/community/saved")
        time.sleep(3.5)
        w.recover()
        w.shot("crud-saved-list")
        unsaved = False
        for lab in ["Unsave", "Remove", "Saved"]:
            if w.tap_text(lab):
                unsaved = True
                break
        rec(fh, rows, {"phase": "crud", "name": "post:unsave", "status": "PASS" if unsaved else "WARN", "note": f"unsaved={unsaved}"})
    except Exception as e:
        rec(fh, rows, {"phase": "crud", "name": "save:flow", "status": "FAIL", "note": str(e)})
        w.recover()

    # --- Profile edit ---
    try:
        open_url("/profile")
        time.sleep(4.0)
        w.recover()
        w.shot("crud-profile")
        opened = w.tap_text("Edit profile") or w.tap_text("Edit") or w.tap_text("Add a headline")
        time.sleep(2.0)
        saved = False
        if opened:
            w.shot("crud-profile-edit")
            w.tap_xy(w.w * 0.5, w.h * 0.35)
            w.type_text(f" {MARKER}")
            saved = w.tap_text("Save") or w.tap_text("Done")
            time.sleep(2.0)
            w.shot("crud-profile-saved")
        rec(
            fh,
            rows,
            {
                "phase": "crud",
                "name": "profile:edit",
                "status": "PASS" if saved else "WARN",
                "note": f"opened={opened}; saved={saved}",
            },
        )
        w.dismiss()
    except Exception as e:
        rec(fh, rows, {"phase": "crud", "name": "profile:flow", "status": "FAIL", "note": str(e)})
        w.recover()

    # --- Create forms (open + dismiss) ---
    for name, path, buttons in [
        ("job:create_form", "/community/jobs", ["Post a job", "+ Post a job"]),
        ("group:create_form", "/community/groups", ["Create group"]),
        ("event:create_form", "/community/events", ["Create event", "Create"]),
        ("shop:create_form", "/create-my-shop", []),
        ("address:create_form", "/addresses", ["Add address", "Add", "New address"]),
        ("payment:create_form", "/payment-methods", ["Add", "Add card", "Add payment"]),
    ]:
        try:
            open_url(path)
            time.sleep(3.5)
            w.recover()
            opened = False
            for b in buttons:
                if w.tap_text(b):
                    opened = True
                    break
            time.sleep(2.0)
            labels = w.labels()
            kind = w.classify_labels(labels)
            w.shot(f"crud-form-{name.replace(':', '-')}")
            status = "PASS" if kind != "error_ui" else "FAIL"
            if buttons and not opened and kind == "ok":
                status = "WARN"
            rec(
                fh,
                rows,
                {
                    "phase": "crud",
                    "name": name,
                    "status": status,
                    "note": f"opened={opened}; kind={kind}; labels={len(labels)}",
                },
            )
            w.dismiss()
            w.dismiss()
        except Exception as e:
            rec(fh, rows, {"phase": "crud", "name": name, "status": "FAIL", "note": str(e)})
            w.recover()

    # --- Search ---
    try:
        open_url("/search")
        time.sleep(3.0)
        w.recover()
        focused = w.tap_text("Search for anything") or w.tap_xy(w.w * 0.5, w.h * 0.08)
        typed = w.type_text("saree")
        try:
            w.api("POST", f"{w.S}/wda/keys", {"value": ["\n"]}, timeout=10)
        except Exception:
            pass
        time.sleep(3.0)
        labels = w.labels()
        w.shot("crud-search-saree")
        rec(
            fh,
            rows,
            {
                "phase": "crud",
                "name": "search:query",
                "status": "PASS" if typed and w.classify_labels(labels) != "error_ui" else "WARN",
                "note": f"focused={focused}; typed={typed}; n={len(labels)}",
            },
        )
    except Exception as e:
        rec(fh, rows, {"phase": "crud", "name": "search:query", "status": "FAIL", "note": str(e)})


def write_report(rows: list[dict]) -> None:
    def c(s: str) -> int:
        return sum(1 for r in rows if r.get("status") == s)

    lines = [
        "# iPad full feature + CRUD QA report",
        "",
        f"- Finished: `{datetime.now(timezone.utc).isoformat()}`",
        f"- Device: `{DEVICE}`",
        f"- Bundle: `{BUNDLE}`",
        f"- Marker: `{MARKER}`",
        f"- Screenshots: `{OUT}`",
        "",
        "## Summary",
        "",
        f"- Total checks: **{len(rows)}**",
        f"- PASS: **{c('PASS')}**",
        f"- WARN: **{c('WARN')}**",
        f"- FAIL: **{c('FAIL')}**",
        f"- SKIP (control not on screen): **{c('SKIP')}**",
        "",
        "## Failures",
        "",
    ]
    fails = [r for r in rows if r["status"] == "FAIL"]
    lines += [f"- **FAIL** `{r['phase']}:{r['name']}` — {r.get('note')}" for r in fails] or ["- None"]
    lines += ["", "## Warnings (first 50)", ""]
    warns = [r for r in rows if r["status"] == "WARN"]
    lines += [f"- **WARN** `{r['phase']}:{r['name']}` — {r.get('note')}" for r in warns[:50]] or ["- None"]
    if len(warns) > 50:
        lines.append(f"- …and {len(warns) - 50} more")
    lines += ["", "## By phase", ""]
    for phase in ["route", "nav", "button", "crud"]:
        sub = [r for r in rows if r["phase"] == phase]
        lines.append(
            f"- `{phase}`: {len(sub)} "
            f"(PASS={sum(1 for r in sub if r['status']=='PASS')}, "
            f"WARN={sum(1 for r in sub if r['status']=='WARN')}, "
            f"FAIL={sum(1 for r in sub if r['status']=='FAIL')}, "
            f"SKIP={sum(1 for r in sub if r['status']=='SKIP')})"
        )
    lines += ["", "## Scope notes", ""]
    lines += [
        "- Route phase opens every major feature URL and checks process alive + non-blank screenshot.",
        "- Nav phase taps every top tab and product bottom tabs.",
        "- Button phase taps primary CTAs when present (`SKIP` = not on that screen).",
        "- CRUD phase performs create/edit/delete for posts (best-effort), cart add/remove, save/unsave, profile edit, and opens create forms for jobs/groups/events/shop/address/payment.",
        "- Admin CMS and seller inventory full CRUD are role-gated; vendor routes are opened for crash/error checks only.",
        "",
        "## All results",
        "",
    ]
    for r in rows:
        lines.append(f"- **{r['status']}** `{r['phase']}:{r['name']}` — {r.get('note')}")
    REPORT.write_text("\n".join(lines) + "\n")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if JSONL.exists():
        JSONL.unlink()
    rows: list[dict] = []
    with JSONL.open("a") as fh:
        phase_routes(fh, rows)
        print("Starting WDA for interactive phases…", flush=True)
        ensure_wda()
        w = Wda()
        w.start()
        print(f"Session {w.sid} {w.w}x{w.h}", flush=True)
        phase_nav_and_buttons(w, fh, rows)
        phase_crud(w, fh, rows)
        w.stop()
    write_report(rows)
    print(f"Report: {REPORT}", flush=True)
    return 1 if any(r["status"] == "FAIL" for r in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
