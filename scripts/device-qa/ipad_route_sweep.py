#!/usr/bin/env python3
"""
iPad USB route sweep via xcrun devicectl deep links + syslog error scan.

Does not require WDA / sudo RSD tunnel. Exercises native screen mounts for
every major tab and feature route; flags process death and JS/native errors.
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

DEVICE = "4B264D11-0D94-563C-9F1C-68B874AD0B3C"
UDID = "00008112-001E24500E81A01E"
BUNDLE = "com.sheconomy.ecommerce"
SCHEME = "sheconomy"
OUT_DIR = Path(__file__).resolve().parents[2] / ".tmp" / "ipad-qa"
REPORT = OUT_DIR / "IPAD_NATIVE_QA_REPORT.md"
JSONL = OUT_DIR / "route-results.jsonl"

# Major tabs + feature routes (relative paths opened as sheconomy://host/path)
ROUTES: list[tuple[str, str]] = [
    # Store / commerce tabs & features
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
    ("store/listing_sample", "/listing/red-striped-table-mat-corner-lotus-online"),
    ("store/shop_sample", "/shop/sidscreation"),
    ("store/category_sample", "/category/fashion"),
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
    ("community/analytics", "/community/analytics"),
    ("community/post_sample", "/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a"),
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
    # Account / settings
    ("account/profile", "/profile"),
    ("account/notifications", "/notifications"),
    ("account/settings", "/settings"),
    ("account/settings_account", "/settings/account"),
    ("account/settings_security", "/settings/security"),
    ("account/settings_appearance", "/settings/appearance"),
    ("account/settings_notifications", "/settings/notifications"),
    ("account/settings_privacy", "/settings/privacy"),
    ("account/help", "/help"),
    # Vendor (may require seller auth — still must not crash)
    ("vendor/home", "/vendor"),
    ("vendor/myshop", "/vendor/myshop"),
    ("vendor/products", "/vendor/products"),
    ("vendor/orders", "/vendor/orders"),
    # Blog / creator
    ("blog/home", "/blog"),
    ("creator/hub_probe", "/u/yoreb96930"),
]

ERROR_RE = re.compile(
    r"("
    r"Error Boundary|error on route|Invariant Violation|Unhandled JS Exception|"
    r"TypeError|ReferenceError|RangeError|SyntaxError|"
    r"is not a function|Cannot read propert|undefined is not|"
    r"View config getter|Native module|RCTFatal|"
    r"JavaScriptException|RedBox|YellowBox|"
    r"Failed to load|Network request failed|"
    r"usePushNotifications must be used|useScreenZoom must be used|"
    r"useCommunityUi.*doesn.?t exist|Property 'useCommunityUi'"
    r")",
    re.I,
)


def run(cmd: list[str], timeout: float = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)


def app_pid() -> int | None:
    r = run(
        [
            "xcrun",
            "devicectl",
            "device",
            "info",
            "processes",
            "--device",
            DEVICE,
        ],
        timeout=30,
    )
    for line in (r.stdout or "").splitlines():
        if "SHEconomy.app/SHEconomy" in line or f"{BUNDLE}" in line and "SHEconomy" in line:
            parts = line.strip().split()
            if parts and parts[0].isdigit():
                return int(parts[0])
    # Fallback: any line with SHEconomy binary
    for line in (r.stdout or "").splitlines():
        if "/SHEconomy.app/SHEconomy" in line:
            parts = line.strip().split()
            if parts and parts[0].isdigit():
                return int(parts[0])
    return None


def launch_url(path: str) -> tuple[bool, str]:
    """Open a path in the already-running app (no terminate — that hangs on this device)."""
    https_url = f"https://www.sheconomy.in{path}" if path.startswith("/") else path
    custom_url = f"{SCHEME}:/{path}" if path.startswith("/") else f"{SCHEME}://{path}"
    last = "launch failed"
    for url in (https_url, custom_url):
        r = run(
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
            timeout=50,
        )
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        last = out[-500:] if out else last
        if r.returncode == 0 and "Launched application" in out:
            return True, last
    return False, last


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    JSONL.write_text("")
    started = datetime.now(timezone.utc).isoformat()

    # Fresh launch (avoid --terminate-existing; it can hang CoreDevice on this iPad)
    cold = run(
        [
            "xcrun",
            "devicectl",
            "device",
            "process",
            "launch",
            "--device",
            DEVICE,
            "--timeout",
            "90",
            BUNDLE,
        ],
        timeout=100,
    )
    print("cold_launch:", ((cold.stdout or "") + (cold.stderr or ""))[-300:])
    time.sleep(8)
    base_pid = app_pid()
    print("base_pid:", base_pid)
    if base_pid is None:
        print("FATAL: SHEconomy not running after cold launch")
        return 2

    # Start syslog capture
    syslog_path = OUT_DIR / "device-syslog.txt"
    syslog_proc = subprocess.Popen(
        ["idevicesyslog", "-u", UDID],
        stdout=open(syslog_path, "w"),
        stderr=subprocess.STDOUT,
        text=True,
    )
    time.sleep(1)

    results: list[dict] = []
    try:
        for name, path in ROUTES:
            before = app_pid()
            mark = f"QA_MARK {name} {path} {time.time()}"
            # Write mark into syslog by echoing via process isn't possible; timestamp window instead
            t0 = time.time()
            ok_launch, launch_msg = launch_url(path)
            time.sleep(4.5)  # allow screen + loaders
            after = app_pid()
            alive = after is not None
            crashed = before is not None and after is None
            # If process pid changed, still consider alive if running
            row = {
                "name": name,
                "path": path,
                "launch_ok": ok_launch,
                "alive": alive,
                "crashed": crashed or (ok_launch and not alive),
                "pid_before": before,
                "pid_after": after,
                "launch_msg": launch_msg,
                "elapsed_s": round(time.time() - t0, 2),
            }
            results.append(row)
            with JSONL.open("a") as f:
                f.write(json.dumps(row) + "\n")
            status = "FAIL" if row["crashed"] or not row["alive"] else ("WARN" if not ok_launch else "PASS")
            print(f"[{status}] {name} {path} pid={after}")
            # Brief settle if we just relaunched after crash
            if not alive:
                run(
                    [
                        "xcrun",
                        "devicectl",
                        "device",
                        "process",
                        "launch",
                        "--device",
                        DEVICE,
                        "--timeout",
                        "90",
                        BUNDLE,
                    ],
                    timeout=100,
                )
                time.sleep(6)
    finally:
        syslog_proc.terminate()
        try:
            syslog_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            syslog_proc.kill()

    # Scan syslog for errors
    syslog_text = syslog_path.read_text(errors="ignore") if syslog_path.exists() else ""
    error_hits = ERROR_RE.findall(syslog_text)
    # Unique-ish lines containing errors
    error_lines = [
        ln.strip()
        for ln in syslog_text.splitlines()
        if ERROR_RE.search(ln) and "QA_MARK" not in ln
    ]
    # Deduplicate keeping order
    seen: set[str] = set()
    unique_errors: list[str] = []
    for ln in error_lines:
        key = ln[-180:]
        if key in seen:
            continue
        seen.add(key)
        unique_errors.append(ln[-240:])
        if len(unique_errors) >= 40:
            break

    passed = [r for r in results if r["alive"] and not r["crashed"] and r["launch_ok"]]
    warned = [r for r in results if r["alive"] and not r["crashed"] and not r["launch_ok"]]
    failed = [r for r in results if r["crashed"] or not r["alive"]]

    lines = [
        f"# iPad native QA report",
        "",
        f"- Started: `{started}`",
        f"- Device: iPad Pro USB `{DEVICE}` / `{UDID}`",
        f"- Bundle: `{BUNDLE}`",
        f"- Method: deep-link route sweep via `devicectl --payload-url` + `idevicesyslog` error scan",
        f"- Note: Full tap/gesture automation needs WDA + sudo RSD tunnel (not available in this session)",
        f"- Base PID after cold launch: `{base_pid}`",
        "",
        f"## Summary",
        f"- Routes exercised: **{len(results)}**",
        f"- Pass (launched + stayed alive): **{len(passed)}**",
        f"- Warn (alive but launch message unclear): **{len(warned)}**",
        f"- Fail (crashed / process gone): **{len(failed)}**",
        f"- Syslog error pattern hits: **{len(error_hits)}** (unique lines kept: {len(unique_errors)})",
        "",
        "## Failures",
    ]
    if not failed:
        lines.append("- None — app process stayed alive across all deep links.")
    else:
        for r in failed:
            lines.append(f"- `{r['name']}` `{r['path']}` — crashed={r['crashed']} alive={r['alive']}")

    lines += ["", "## Warnings"]
    if not warned:
        lines.append("- None")
    else:
        for r in warned:
            lines.append(f"- `{r['name']}` `{r['path']}`")

    lines += ["", "## Syslog error samples"]
    if not unique_errors:
        lines.append("- No matching JS/native error markers in syslog during the sweep.")
    else:
        for ln in unique_errors[:25]:
            lines.append(f"- `{ln}`")

    lines += ["", "## All routes"]
    for r in results:
        tag = "FAIL" if r in failed else ("WARN" if r in warned else "PASS")
        lines.append(
            f"- **{tag}** `{r['name']}` `{r['path']}` pid={r['pid_after']} ({r['elapsed_s']}s)"
        )

    REPORT.write_text("\n".join(lines) + "\n")
    print("\n" + REPORT.read_text())
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
