#!/usr/bin/env python3
"""Sign in on device with email OTP (real Supabase path)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adb_ui import (  # noqa: E402
    deep_link,
    dump_ui,
    find_by_text,
    find_edit_texts,
    find_nodes,
    keyevent,
    launch,
    logcat_errors,
    pid,
    poll_otp,
    shell,
    tap_bounds,
    tap_text,
    text_input,
    ui_summary,
)

EMAIL = "sanjeev.shukla@bioayurveda.in"


def clear_focused_field(n: int = 60) -> None:
    shell("input", "keyevent", "KEYCODE_MOVE_END", check=False)
    for _ in range(n):
        keyevent(67)  # DEL


def labels() -> list[str]:
    out: list[str] = []
    for n in find_nodes():
        out.append(n.attrib.get("content-desc") or "")
        out.append(n.attrib.get("text") or "")
    return out


def wait_for(substr: str, timeout_s: float = 20) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        dump_ui()
        blob = "\n".join(ui_summary()).lower()
        if substr.lower() in blob:
            return True
        time.sleep(1)
    return False


def is_signed_in() -> bool:
    """True when bottom tab is not Sign-in and auth-gated route loads."""
    deep_link("settings")
    time.sleep(2.5)
    dump_ui()
    blob = "\n".join(ui_summary()).lower()
    if "one-time code" in blob and "sign in or create" in blob:
        return False
    descs = labels()
    if "Sign in" in descs and "You" not in descs and "Account" not in descs:
        # Still guest chrome
        if "appearance" not in blob and "security" not in blob and "settings" not in blob:
            return False
    # Settings content or profile chrome implies session
    if any(k in blob for k in ("appearance", "security", "privacy", "account", "sign out", "log out")):
        return True
    deep_link("profile")
    time.sleep(2)
    dump_ui()
    blob = "\n".join(ui_summary()).lower()
    if "one-time code" in blob and "sign in or create" in blob:
        return False
    return "sign in" not in [d.lower() for d in labels() if d in ("Sign in", "sign in")]


def main() -> int:
    Path("/tmp/device-qa").mkdir(parents=True, exist_ok=True)
    logcat_errors(since_clear=True)

    # Fresh start reduces stale auth/UI state
    print("== launch app ==")
    shell("am", "force-stop", "com.sheconomy.ecommerce", check=False)
    time.sleep(1)
    launch()
    time.sleep(4)

    if is_signed_in():
        print("AUTH_STATUS=signed_in (already)")
        print("pid", pid())
        return 0

    print("== open sign-in ==")
    deep_link("auth/sign-in")
    time.sleep(3)
    if not pid():
        launch()
        time.sleep(3)
        deep_link("auth/sign-in")
        time.sleep(3)

    dump_ui()
    print("UI sample:")
    for line in ui_summary()[:30]:
        print(" ", line)

    tap_text("Email") or tap_text("Sign in with Email")
    time.sleep(1)

    # If already on OTP step from a prior attempt, go back to email
    if "Enter verification code" in "\n".join(ui_summary()):
        tap_text("Change email") or tap_text("Change") or tap_text("Go back")
        time.sleep(1.5)
        dump_ui()

    edits = find_edit_texts()
    print(f"edit fields: {len(edits)}")
    if not edits:
        dump_ui()
        print("NO email field")
        for line in ui_summary():
            print(" ", line)
        return 1

    tap_bounds(edits[0].attrib["bounds"])
    time.sleep(0.4)
    clear_focused_field(80)
    text_input(EMAIL)
    time.sleep(0.8)
    # Hide keyboard so Continue is visible/tappable
    keyevent(4)
    time.sleep(0.5)
    dump_ui()
    email_blob = "\n".join(ui_summary())
    if "bioayurveda" not in email_blob.lower():
        print("WARN: email may not have landed; retrying type")
        edits = find_edit_texts()
        if not edits:
            print("FAILED: email field gone")
            return 5
        tap_bounds(edits[0].attrib["bounds"])
        clear_focused_field(100)
        text_input(EMAIL)
        time.sleep(0.8)
        keyevent(4)
        time.sleep(0.5)
        dump_ui()
        email_blob = "\n".join(ui_summary())
        print("email UI snippet:", [l for l in ui_summary() if "@" in l or "bio" in l.lower()][:5])
    if "bioayurveda" not in email_blob.lower():
        print("FAILED: could not enter email")
        return 5
    print("Email entered OK")

    if not (tap_text("Continue") or tap_text("Sending code") or tap_text("Send")):
        print("Could not find Continue button")
        for line in ui_summary():
            print(" ", line)
        return 1

    print("== waiting for OTP step ==")
    if not wait_for("Enter verification code", 25):
        dump_ui()
        print("FAILED: OTP step UI not shown")
        Path("/tmp/device-qa/post-auth-ui.txt").write_text("\n".join(ui_summary()))
        for line in ui_summary()[:40]:
            print(" ", line)
        return 2

    print("== OTP requested; polling device notifications/SMS ==")
    otp = poll_otp(90)
    print(f"OTP detected: {otp!r}")
    if not otp:
        print("OTP_NOT_FOUND — waiting for /tmp/device-qa/otp.txt")
        deadline = time.time() + 120
        while time.time() < deadline:
            p = Path("/tmp/device-qa/otp.txt")
            if p.exists():
                otp = p.read_text().strip()
                if otp:
                    break
            time.sleep(2)
    if not otp:
        print("FAILED: no OTP")
        return 2

    dump_ui()
    # Prefer labeled OTP field
    target = find_by_text("One-time verification code") or find_by_text("verification code")
    edits = find_edit_texts()
    if target is None and edits:
        target = edits[-1]
    if target is None:
        print("No OTP field")
        for line in ui_summary():
            print(" ", line)
        return 3

    tap_bounds(target.attrib["bounds"])
    time.sleep(0.3)
    clear_focused_field(12)
    text_input(otp)
    time.sleep(1)
    tap_text("Continue") or tap_text("Verifying")
    # Auto-verify may already fire on 6 digits
    time.sleep(6)

    dump_ui()
    Path("/tmp/device-qa/post-auth-ui.txt").write_text("\n".join(ui_summary()))

    # Complete profile / onboarding if present
    for _ in range(4):
        blob = "\n".join(ui_summary()).lower()
        if "complete your profile" in blob or "what's your name" in blob or "display name" in blob:
            print("Onboarding detected — attempting skip/continue")
            tap_text("Skip") or tap_text("Later") or tap_text("Continue")
            time.sleep(2)
            dump_ui()
        else:
            break

    if not is_signed_in():
        print("AUTH_STATUS=failed")
        for line in ui_summary()[:50]:
            print(" ", line)
        errs = logcat_errors()
        if errs:
            print("LOGCAT:", errs[:500])
        return 4

    print("AUTH_STATUS=signed_in")
    print("pid", pid())
    errs = logcat_errors()
    if errs:
        print("LOGCAT:", errs[:500])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
