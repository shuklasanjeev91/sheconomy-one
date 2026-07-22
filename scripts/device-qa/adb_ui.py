#!/usr/bin/env python3
"""Minimal adb UI helpers for device QA on Android."""
from __future__ import annotations

import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

SERIAL = "RZCT80X8MVA"
PKG = "com.sheconomy.ecommerce"
DUMP = Path("/tmp/device-qa/uidump.xml")


def adb(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    cmd = ["adb", "-s", SERIAL, *args]
    return subprocess.run(cmd, text=True, capture_output=True, check=check)


def shell(*args: str, check: bool = True) -> str:
    r = adb("shell", *args, check=check)
    return (r.stdout or "") + (r.stderr or "")


def dump_ui(path: Path = DUMP) -> ET.Element:
    last_err: Exception | None = None
    for attempt in range(5):
        adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml", check=False)
        adb("pull", "/sdcard/uidump.xml", str(path), check=False)
        try:
            if path.exists() and path.stat().st_size > 50:
                return ET.parse(path).getroot()
        except ET.ParseError as e:
            last_err = e
        time.sleep(0.6 + attempt * 0.3)
    if last_err:
        raise last_err
    raise RuntimeError(f"uiautomator dump empty/unreadable: {path}")


def parse_bounds(bounds: str) -> tuple[int, int, int, int]:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not m:
        raise ValueError(bounds)
    return tuple(map(int, m.groups()))  # type: ignore[return-value]


def center(bounds: str) -> tuple[int, int]:
    l, t, r, b = parse_bounds(bounds)
    return (l + r) // 2, (t + b) // 2


def tap(x: int, y: int) -> None:
    shell("input", "tap", str(x), str(y))


def tap_bounds(bounds: str) -> None:
    x, y = center(bounds)
    tap(x, y)


def swipe(x1: int, y1: int, x2: int, y2: int, ms: int = 300) -> None:
    shell("input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms))


def text_input(s: str) -> None:
    # `adb shell input text` is ASCII-ish; spaces → %s; drop other specials
    cleaned = "".join(ch if ord(ch) < 128 else "-" for ch in s)
    escaped = cleaned.replace(" ", "%s").replace("'", "").replace('"', "").replace("\\", "")
    shell("input", "text", escaped, check=False)


def paste_text(s: str) -> None:
    """Best-effort clipboard paste; falls back to text_input."""
    r = adb("shell", "cmd", "clipboard", "set-text", s, check=False)
    if "No shell command" in ((r.stdout or "") + (r.stderr or "")) or r.returncode != 0:
        text_input(s)
        return
    time.sleep(0.2)
    shell("input", "keyevent", "279", check=False)


def keyevent(code: int) -> None:
    shell("input", "keyevent", str(code))


def find_nodes(root: ET.Element | None = None):
    if root is None:
        root = dump_ui()
    for n in root.iter("node"):
        yield n


def find_by_text(substr: str, *, clickable_only: bool = False):
    substr_l = substr.lower()
    for n in find_nodes():
        text = (n.attrib.get("text") or "") + " " + (n.attrib.get("content-desc") or "")
        if substr_l not in text.lower():
            continue
        if clickable_only and n.attrib.get("clickable") != "true":
            # Prefer clickable ancestor bounds if needed — use node bounds anyway
            pass
        return n
    return None


def tap_text(substr: str) -> bool:
    n = find_by_text(substr)
    if n is None:
        return False
    tap_bounds(n.attrib["bounds"])
    return True


def find_edit_texts():
    return [n for n in find_nodes() if "EditText" in (n.attrib.get("class") or "")]


def deep_link(path: str) -> None:
    path = path.lstrip("/")
    url = f"sheconomy://{path}" if path else "sheconomy://"
    shell(
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        url,
        PKG,
        check=False,
    )


def force_stop() -> None:
    shell("am", "force-stop", PKG, check=False)


def launch() -> None:
    shell("am", "start", "-n", f"{PKG}/.MainActivity", check=False)


def pid() -> str:
    return shell("pidof", "-s", PKG, check=False).strip()


def logcat_errors(since_clear: bool = False) -> str:
    if since_clear:
        adb("logcat", "-c", check=False)
        return ""
    r = adb(
        "logcat",
        "-d",
        check=False,
    )
    lines = []
    for line in (r.stdout or "").splitlines():
        if PKG not in line and "ReactNative" not in line and "JavascriptException" not in line:
            if "FATAL EXCEPTION" not in line and "async generators" not in line:
                continue
        if any(
            k in line
            for k in (
                "JavascriptException",
                "async generators",
                "FATAL EXCEPTION",
                "Unable to load",
                "lmkd",
            )
        ):
            lines.append(line)
    return "\n".join(lines[-40:])


def extract_otp_from_text(blob: str) -> str | None:
    # Prefer 6-digit codes common for Supabase
    matches = re.findall(r"\b(\d{6})\b", blob)
    if matches:
        return matches[-1]
    matches = re.findall(r"\b(\d{4,8})\b", blob)
    return matches[-1] if matches else None


def poll_otp(timeout_s: int = 90) -> str | None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        # Notifications
        notif = shell("dumpsys", "notification", "--noredact", check=False)
        otp = extract_otp_from_text(notif)
        if otp and ("sheconomy" in notif.lower() or "supabase" in notif.lower() or "otp" in notif.lower() or "code" in notif.lower() or "bioayurveda" in notif.lower() or "verify" in notif.lower()):
            return otp
        # Broader: any recent 6-digit in notification extras mentioning mail
        if otp and ("mail" in notif.lower() or "gmail" in notif.lower()):
            return otp
        # SMS inbox (may fail without permission)
        sms = shell(
            "content",
            "query",
            "--uri",
            "content://sms/inbox",
            "--projection",
            "body:date",
            "--sort",
            "date DESC",
            check=False,
        )
        otp2 = extract_otp_from_text(sms)
        if otp2:
            return otp2
        time.sleep(3)
    # Last resort: last 6-digit in notifications regardless
    notif = shell("dumpsys", "notification", "--noredact", check=False)
    return extract_otp_from_text(notif)


def ui_summary() -> list[str]:
    out = []
    for n in find_nodes():
        text = n.attrib.get("text") or ""
        desc = n.attrib.get("content-desc") or ""
        if text or desc:
            out.append(f"{text}|{desc}|{n.attrib.get('bounds')}")
    return out
