#!/usr/bin/env python3
"""
iPad visual + route QA: deep-link every major tab/feature, screenshot each screen,
flag blank/error UIs by image heuristics and optional OCR-free size checks.
"""
from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

DEVICE = "4B264D11-0D94-563C-9F1C-68B874AD0B3C"
BUNDLE = "com.sheconomy.ecommerce"
OUT = Path(__file__).resolve().parents[2] / ".tmp" / "ipad-qa" / "visual"
REPORT = Path(__file__).resolve().parents[2] / ".tmp" / "ipad-qa" / "IPAD_VISUAL_QA_REPORT.md"
VENV_PY = Path(__file__).resolve().parents[2] / ".tmp" / "device-qa-venv" / "bin" / "python"

# (name, path, expected bottom-tab or section hint for notes)
SCREENS: list[tuple[str, str]] = [
    # Top section tabs
    ("01-commerce-home", "/"),
    ("02-community-home", "/community"),
    ("03-chat-home", "/chat"),
    ("04-class-home", "/class"),
    ("05-cowork-home", "/co-work"),
    # Commerce features
    ("06-shops", "/shops"),
    ("07-favorites", "/favorites"),
    ("08-cart", "/cart"),
    ("09-search", "/search"),
    ("10-orders", "/orders"),
    ("11-listing", "/listing/red-striped-table-mat-corner-lotus-online"),
    ("12-shop-detail", "/shop/sidscreation"),
    # Community features
    ("13-network", "/community/network"),
    ("14-create-post", "/community/create"),
    ("15-jobs", "/community/jobs"),
    ("16-groups", "/community/groups"),
    ("17-events", "/community/events"),
    ("18-companies", "/community/companies"),
    ("19-stories", "/community/stories"),
    ("20-saved", "/community/saved"),
    ("21-people", "/community/people"),
    ("22-post-detail", "/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a"),
    # Chat / class / cowork sub
    ("23-chat-groups", "/chat/groups"),
    ("24-chat-calls", "/chat/calls"),
    ("25-class-video", "/class/video"),
    ("26-class-audio", "/class/audio"),
    ("27-class-playlists", "/class/playlists"),
    ("28-cowork-schedule", "/co-work/schedule"),
    ("29-cowork-meetings", "/co-work/meetings"),
    # Account
    ("30-profile", "/profile"),
    ("31-notifications", "/notifications"),
    ("32-settings", "/settings"),
    ("33-help", "/help"),
    # Vendor
    ("34-vendor", "/vendor"),
    ("35-vendor-myshop", "/vendor/myshop"),
    ("36-vendor-products", "/vendor/products"),
    # Blog
    ("37-blog", "/blog"),
]


def run(cmd: list[str], timeout: float = 90) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)


def app_alive() -> bool:
    r = run(
        ["xcrun", "devicectl", "device", "info", "processes", "--device", DEVICE, "--timeout", "30"],
        timeout=40,
    )
    return "SHEconomy.app/SHEconomy" in (r.stdout or "")


def open_path(path: str) -> bool:
    url = f"https://www.sheconomy.in{path}"
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
        timeout=55,
    )
    out = (r.stdout or "") + (r.stderr or "")
    return r.returncode == 0 and "Launched application" in out


def screenshot(dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        dest.unlink()
    r = run(
        [
            str(VENV_PY),
            "-m",
            "pymobiledevice3",
            "developer",
            "dvt",
            "screenshot",
            str(dest),
        ],
        timeout=60,
    )
    return dest.exists() and dest.stat().st_size > 50_000


def classify_png(path: Path) -> str:
    """Cheap visual health check without OCR."""
    try:
        from PIL import Image
        import statistics

        im = Image.open(path).convert("RGB")
        # Sample grid of pixels
        w, h = im.size
        samples = []
        for y in range(0, h, max(1, h // 24)):
            for x in range(0, w, max(1, w // 24)):
                samples.append(im.getpixel((x, y)))
        # Near-white / near-pink blank?
        avg = tuple(sum(c[i] for c in samples) / len(samples) for i in range(3))
        # Variance across samples
        lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in samples]
        var = statistics.pvariance(lum) if len(lum) > 1 else 0
        if var < 30 and avg[0] > 240 and avg[1] > 240 and avg[2] > 240:
            return "blank_white"
        if var < 40:
            return "low_variance"
        return "ok"
    except Exception as e:
        # Fallback: size only
        size = path.stat().st_size
        if size < 80_000:
            return f"tiny_file({size})"
        return "ok_no_pil"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat()

    # Ensure app running
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
    time.sleep(5)

    results = []
    for name, path in SCREENS:
        t0 = time.time()
        launched = open_path(path)
        time.sleep(3.8)
        alive = app_alive()
        shot = OUT / f"{name}.png"
        shot_ok = screenshot(shot) if alive else False
        visual = classify_png(shot) if shot_ok else "no_screenshot"
        status = "PASS"
        if not alive:
            status = "FAIL_CRASH"
        elif not launched:
            status = "WARN_LAUNCH"
        elif not shot_ok:
            status = "WARN_SHOT"
        elif visual.startswith("blank") or visual.startswith("tiny") or visual == "low_variance":
            status = "WARN_VISUAL"
        row = {
            "name": name,
            "path": path,
            "status": status,
            "launched": launched,
            "alive": alive,
            "screenshot": str(shot) if shot_ok else None,
            "bytes": shot.stat().st_size if shot_ok else 0,
            "visual": visual,
            "elapsed_s": round(time.time() - t0, 2),
        }
        results.append(row)
        print(f"[{status}] {name} {path} visual={visual} bytes={row['bytes']}")
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
            time.sleep(5)

    passed = [r for r in results if r["status"] == "PASS"]
    warns = [r for r in results if r["status"].startswith("WARN")]
    fails = [r for r in results if r["status"].startswith("FAIL")]

    lines = [
        "# iPad visual QA report",
        "",
        f"- Started: `{started}`",
        f"- Device: iPad Pro USB `{DEVICE}`",
        f"- Method: deep-link each screen → `pymobiledevice3 developer dvt screenshot` → image health check",
        f"- Screenshots: `{OUT}`",
        "",
        "## Summary",
        f"- Screens: **{len(results)}**",
        f"- Pass: **{len(passed)}**",
        f"- Warn: **{len(warns)}**",
        f"- Fail: **{len(fails)}**",
        "",
        "## Failures",
    ]
    if not fails:
        lines.append("- None")
    else:
        for r in fails:
            lines.append(f"- `{r['name']}` `{r['path']}` — {r['status']} / {r['visual']}")

    lines += ["", "## Warnings"]
    if not warns:
        lines.append("- None")
    else:
        for r in warns:
            lines.append(f"- `{r['name']}` `{r['path']}` — {r['status']} / {r['visual']}")

    lines += ["", "## All screens"]
    for r in results:
        lines.append(
            f"- **{r['status']}** `{r['name']}` `{r['path']}` visual=`{r['visual']}` ({r['bytes']} bytes)"
        )

    REPORT.write_text("\n".join(lines) + "\n")
    (OUT / "results.json").write_text(json.dumps(results, indent=2))
    print("\n" + REPORT.read_text())
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
