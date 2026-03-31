#!/usr/bin/env python3
"""
从 WooCommerce REST API v3 分页拉取商品，跳过可变商品（variable），
按 SKU 规则创建文件夹并下载主图 + 画廊图。

认证：环境变量 WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET（HTTP Basic，与 woo-client.ts 一致）。

示例：
  set WOO_SITE_URL=https://vaultcaredubai.com
  set WOO_CONSUMER_KEY=ck_...
  set WOO_CONSUMER_SECRET=cs_...
  python scripts/download_woo_product_images_by_sku.py --dry-run
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

# Windows 非法文件名字符及控制字符
_INVALID_DIR_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_MAX_FOLDER_LEN = 200


def _env(name: str, default: str | None = None) -> str | None:
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    return v.strip()


def _sanitize_sku_for_dir(sku: str) -> str:
    s = _INVALID_DIR_CHARS.sub("_", sku.strip())
    s = re.sub(r"_+", "_", s).strip("._")
    if len(s) > _MAX_FOLDER_LEN:
        s = s[:_MAX_FOLDER_LEN].rstrip("._")
    return s or "EMPTY"


def _resolve_folder_name(
    sku: str | None,
    product_id: int,
    used_folders: set[str],
) -> str:
    """无 SKU -> NO_SKU_{id}；有 SKU -> 安全名；与已占用冲突 -> {safe}_{id}（必要时再加后缀）。"""
    raw = (sku or "").strip()
    if not raw:
        name = f"NO_SKU_{product_id}"
        used_folders.add(name)
        return name
    base = _sanitize_sku_for_dir(raw)
    if base not in used_folders:
        used_folders.add(base)
        return base
    candidate = f"{base}_{product_id}"
    extra = 0
    while candidate in used_folders:
        extra += 1
        candidate = f"{base}_{product_id}_{extra}"
    used_folders.add(candidate)
    return candidate


def _basic_auth_header(key: str, secret: str) -> str:
    token = base64.b64encode(f"{key}:{secret}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def _iri_to_uri(url: str) -> str:
    """将含非 ASCII 的 IRI 转为 ASCII URI，避免 urllib 在 HTTP 请求行上报 UnicodeEncodeError。"""
    p = urlparse(url.strip())
    path = quote(unquote(p.path), safe="/")
    if p.query:
        try:
            pairs = parse_qsl(p.query, keep_blank_values=True)
            query = urlencode(pairs, safe="=&", encoding="utf-8")
        except (ValueError, TypeError):
            query = quote(unquote(p.query), safe="=&?%")
    else:
        query = ""
    fragment = quote(unquote(p.fragment), safe="") if p.fragment else ""
    return urlunparse((p.scheme, p.netloc, path, p.params, query, fragment))


def _fetch_json(url: str, key: str, secret: str, timeout: int = 60) -> Any:
    req = Request(
        url,
        headers={
            "Authorization": _basic_auth_header(key, secret),
            "Accept": "application/json",
            "User-Agent": "vault-os-woo-image-sync/1.0",
        },
        method="GET",
    )
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _download_file(url: str, dest: Path, timeout: int = 120) -> None:
    safe_url = _iri_to_uri(url)
    req = Request(
        safe_url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; vault-os-woo-image-sync/1.0)"},
        method="GET",
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(req, timeout=timeout) as resp:
        dest.write_bytes(resp.read())


def _ext_from_url(url: str) -> str:
    path = url.split("?", 1)[0]
    ext = Path(path).suffix.lower()
    if ext and len(ext) <= 8 and ext.startswith("."):
        return ext
    return ".jpg"


def _iter_products(
    site_url: str,
    key: str,
    secret: str,
    max_pages: int | None,
    max_products: int | None,
    per_page: int = 100,
) -> list[dict[str, Any]]:
    base = site_url.rstrip("/")
    all_rows: list[dict[str, Any]] = []
    page = 1
    while True:
        if max_pages is not None and page > max_pages:
            break
        q = urlencode(
            {
                "per_page": per_page,
                "page": page,
                "orderby": "id",
                "order": "asc",
            }
        )
        url = f"{base}/wp-json/wc/v3/products?{q}"
        batch = _fetch_json(url, key, secret)
        if not isinstance(batch, list):
            raise RuntimeError(f"Unexpected API response (expected list): {type(batch)}")
        if not batch:
            break
        all_rows.extend(batch)
        if max_products is not None and len(all_rows) >= max_products:
            all_rows = all_rows[:max_products]
            break
        if len(batch) < per_page:
            break
        page += 1
    return all_rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Download WooCommerce product images by SKU folder.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print planned folders and counts; do not download.",
    )
    parser.add_argument("--max-pages", type=int, default=None, help="Stop after N API pages (debug).")
    parser.add_argument(
        "--max-products",
        type=int,
        default=None,
        help="Process at most N products after fetch (overrides env WOO_MAX_PRODUCTS).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        metavar="DIR",
        help="Download root directory (overrides WOO_OUTPUT_DIR). Use for paths with non-ASCII names.",
    )
    args = parser.parse_args()

    site = _env("WOO_SITE_URL")
    key = _env("WOO_CONSUMER_KEY")
    secret = _env("WOO_CONSUMER_SECRET")
    if args.output_dir:
        out_root = Path(args.output_dir).expanduser().resolve()
    else:
        out_root = Path(_env("WOO_OUTPUT_DIR", str(Path("downloads") / "woo-product-images")))
    delay = float(_env("HTTP_DELAY_SEC", "0") or "0")

    max_products_env = _env("WOO_MAX_PRODUCTS")
    max_products = args.max_products
    if max_products is None and max_products_env:
        max_products = int(max_products_env)

    if not site or not key or not secret:
        print(
            "Missing WOO_SITE_URL, WOO_CONSUMER_KEY, or WOO_CONSUMER_SECRET.",
            file=sys.stderr,
        )
        return 1

    max_pages = args.max_pages
    try:
        products = _iter_products(site, key, secret, max_pages, max_products)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"HTTP {e.code}: {body[:2000]}", file=sys.stderr)
        return 1
    except (URLError, OSError, json.JSONDecodeError, RuntimeError) as e:
        print(f"API error: {e}", file=sys.stderr)
        return 1

    used_folders: set[str] = set()
    tasks: list[tuple[str, int, list[str]]] = []

    skipped_variable = 0
    for p in products:
        ptype = (p.get("type") or "").strip().lower()
        if ptype == "variable":
            skipped_variable += 1
            continue
        pid = int(p["id"])
        sku = p.get("sku")
        folder = _resolve_folder_name(
            sku if isinstance(sku, str) else None,
            pid,
            used_folders,
        )
        images = p.get("images") or []
        urls: list[str] = []
        seen_url: set[str] = set()
        if isinstance(images, list):
            for im in images:
                if not isinstance(im, dict):
                    continue
                src = im.get("src")
                if isinstance(src, str) and src.strip() and src not in seen_url:
                    seen_url.add(src)
                    urls.append(src.strip())
        tasks.append((folder, pid, urls))

    total_images = sum(len(u) for _, _, u in tasks)
    print(
        json.dumps(
            {
                "products_fetched": len(products),
                "products_to_sync": len(tasks),
                "skipped_variable": skipped_variable,
                "total_image_urls": total_images,
                "output_root": str(out_root.resolve()),
            },
            ensure_ascii=False,
        )
    )

    if args.dry_run:
        for folder, pid, urls in tasks[:50]:
            print(f"[dry-run] id={pid} folder={folder!r} images={len(urls)}")
        if len(tasks) > 50:
            print(f"[dry-run] ... and {len(tasks) - 50} more products")
        return 0

    out_root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    ok = 0
    fail = 0

    for folder, pid, urls in tasks:
        sub = out_root / folder
        seq = 0
        for src in urls:
            seq += 1
            ext = _ext_from_url(src)
            name = f"{seq:03d}{ext}"
            target = sub / name
            entry: dict[str, Any] = {
                "product_id": pid,
                "folder": folder,
                "file": str(target.relative_to(out_root)),
                "url": src,
                "status": "pending",
            }
            try:
                if delay > 0:
                    time.sleep(delay)
                _download_file(src, target)
                entry["status"] = "ok"
                entry["size"] = target.stat().st_size
                ok += 1
            except (HTTPError, URLError, TimeoutError, OSError) as e:
                entry["status"] = "error"
                entry["error"] = str(e)
                fail += 1
            results.append(entry)

    summary = {
        "site": site,
        "products_synced": len(tasks),
        "skipped_variable": skipped_variable,
        "downloaded_ok": ok,
        "failed": fail,
        "output_root": str(out_root.resolve()),
    }
    summary_path = out_root / "download-summary.json"
    summary_path.write_text(
        json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
