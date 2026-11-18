#!/usr/bin/env python3
"""Convert full-HTML notification email templates into chrome fragments."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def parse_mcp_file(path: Path) -> list[dict]:
    obj = json.loads(path.read_text())
    result = obj["result"]
    starts = [m.start() for m in re.finditer(r"<untrusted-data-[0-9a-f-]+>", result)]
    for s in starts:
        open_end = result.find(">", s) + 1
        rest = result[open_end:].lstrip("\n")
        if not rest.startswith("["):
            continue
        close = result.find("</untrusted-data-", open_end)
        payload = result[open_end:close].strip()
        return json.loads(payload)
    raise SystemExit(f"no json untrusted block in {path}")


def extract_chrome_fragment(html: str) -> str:
    if not html:
        return html
    text = html.replace("\r\n", "\n").replace("\r", "\n")
    if not re.match(r"\s*<(!DOCTYPE|html)\b", text, re.I):
        return text.strip()

    parts = re.split(
        r"height:\s*4px;font-size:\s*0;line-height:\s*0;[^>]*>\s*&nbsp;\s*</td>\s*</tr>",
        text,
        maxsplit=1,
        flags=re.I,
    )
    if len(parts) < 2:
        parts = re.split(
            r"sheconomy-logo/1024X1024\.png[\s\S]*?</td>\s*</tr>",
            text,
            maxsplit=1,
            flags=re.I,
        )
    if len(parts) < 2:
        # Atypical header (e.g. {{brand_logo_url}})
        parts = re.split(
            r"<img[^>]*(?:brand_logo|max-height:\s*56px|alt=\"\{\{shop_name\}\}\")[^>]*>\s*</td>\s*</tr>",
            text,
            maxsplit=1,
            flags=re.I,
        )
    after = parts[1] if len(parts) > 1 else text

    after = re.sub(
        r"^\s*<tr>\s*<td[^>]*height:\s*4px[\s\S]*?</td>\s*</tr>",
        "",
        after,
        count=1,
        flags=re.I,
    )

    foot = re.split(
        r"(?:<!--\s*Footer\s*-->|<tr>\s*<td[^>]*border-top:\s*1px solid[^>]*>)",
        after,
        maxsplit=1,
        flags=re.I,
    )
    body = foot[0]

    body = re.sub(r"<!--\s*Main content\s*-->\s*", "", body, flags=re.I)
    body = re.sub(r"<!--\s*CTA Button[^>]*-->\s*", "", body, flags=re.I)
    body = re.sub(r"^\s*<tr>\s*<td[^>]*>", "", body, count=1, flags=re.I)
    body = re.sub(r"</td>\s*</tr>\s*<tr>\s*<td[^>]*>", "\n", body, flags=re.I)
    body = re.sub(r"</td>\s*</tr>\s*$", "", body, flags=re.I)
    body = re.sub(
        r"</table>\s*</td>\s*</tr>\s*</table>\s*</body>\s*</html>\s*$",
        "",
        body,
        flags=re.I,
    )
    body = body.strip()

    # Last resort: strip document chrome if still full HTML
    if re.match(r"\s*<(!DOCTYPE|html)\b", body, re.I):
        m = re.search(
            r"<!--\s*(?:Status Banner|Main content|Greeting|Accent divider)\s*-->",
            text,
            re.I,
        )
        if m:
            body = text[m.start() :]
        foot_m = re.search(r"<!--\s*Footer\s*-->", body, re.I)
        if foot_m:
            body = body[: foot_m.start()]
        body = re.sub(r"^[\s\S]*?<body[^>]*>", "", body, count=1, flags=re.I)
        body = re.sub(r"</body>\s*</html>\s*$", "", body, flags=re.I)
        body = body.strip()

    return body


def sql_literal(value: str) -> str:
    return "$html$" + value + "$html$"


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        raise SystemExit("usage: convert-emails-to-chrome-fragments.py <mcp-json>...")

    out_dir = Path(".tmp-email-fragments")
    out_dir.mkdir(exist_ok=True)
    rows: list[tuple[str, str]] = []
    for path in paths:
        for row in parse_mcp_file(path):
            key = row["template_key"]
            frag = extract_chrome_fragment(row["email_body_template"])
            if re.match(r"\s*<(!DOCTYPE|html)\b", frag or "", re.I):
                print(f"WARN still full html: {key}", file=sys.stderr)
            (out_dir / f"{key}.html").write_text(frag)
            rows.append((key, frag))
            print(f"{key}: {len(row['email_body_template'])} -> {len(frag)}")

    migration = Path(
        "supabase/migrations/20261118120000_convert_full_html_emails_to_chrome_fragments.sql"
    )
    lines = [
        "-- Convert legacy full-HTML email templates into content fragments.",
        "-- Shared branded chrome is applied at send time via wrapEmailHtml.",
        "",
    ]
    for key, frag in sorted(rows, key=lambda x: x[0]):
        lines.append("UPDATE public.notification_templates")
        lines.append("SET")
        lines.append(f"  email_body_template = {sql_literal(frag)},")
        lines.append("  updated_at = now()")
        lines.append(f"WHERE template_key = '{key}';")
        lines.append("")
    migration.write_text("\n".join(lines))
    print(f"Wrote {migration} ({len(rows)} templates)")


if __name__ == "__main__":
    main()
