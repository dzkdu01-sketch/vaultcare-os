"""
WP CSV 批量导入命令
用法：
    python manage.py import_wp_csv                          # 默认路径
    python manage.py import_wp_csv --csv path/to/file.csv  # 自定义路径
    python manage.py import_wp_csv --dry-run               # 试运行（不写库）
    python manage.py import_wp_csv --wp-site-id 1          # 指定主站 WPSite ID
"""

import csv
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from pim.models import Category, MasterSKU, OperationalTag
from wp_sync.models import WPProductMapping, WPSite

DEFAULT_CSV = Path(__file__).resolve().parents[3] / "pim" / "商品导出模板.csv"

# ---------------------------------------------------------------------------
# WP 分类 → ERP Category code 映射
# ---------------------------------------------------------------------------
CATEGORY_MAP = {
    "vibrators":                "1",
    "dildos":                   "2",
    "buttplay":                 "3",
    "butt plugs":               "3",
    "masturbators":             "4",
    "cock rings & enhancers":   "5",
    "cock rings":               "5",
    "sexual wellness":          "6",
    "med":                      "6",
    "half body sex doll":       "7",
    "full body sex doll":       "8",
    "strap-ons":                "A",
    "strap ons":                "A",
}

AUDIENCE_TAGS = {"for her", "for him", "for_her", "for_him"}
OPERATIONAL_TAG_NAMES = {"best_seller", "best seller", "high_value", "high value", "new_arrival", "new arrival"}

# ---------------------------------------------------------------------------
# 视频短代码提取正则
# ---------------------------------------------------------------------------
VIDEO_PATTERN = re.compile(
    r'\[video[^\]]*mp4="([^"]+)"[^\]]*width="(\d+)"[^\]]*height="(\d+)"[^\]]*\]'
    r'.*?\[/video\]',
    re.DOTALL | re.IGNORECASE,
)

# 宽松版：mp4 属性顺序不固定
VIDEO_PATTERN_ALT = re.compile(
    r'\[video([^\]]*)\].*?\[/video\]',
    re.DOTALL | re.IGNORECASE,
)
MP4_ATTR = re.compile(r'mp4="([^"]+)"')
WIDTH_ATTR = re.compile(r'width="(\d+)"')
HEIGHT_ATTR = re.compile(r'height="(\d+)"')


def parse_description(raw: str) -> tuple[str, list]:
    """提取视频信息，返回 (清理后的描述, 视频列表)。"""
    videos = []
    try:
        for match in VIDEO_PATTERN.finditer(raw):
            videos.append({
                "url": match.group(1),
                "width": int(match.group(2)),
                "height": int(match.group(3)),
            })
        clean = VIDEO_PATTERN.sub("", raw).strip()
        if videos:
            return clean, videos

        # 备用宽松匹配
        for match in VIDEO_PATTERN_ALT.finditer(raw):
            attrs = match.group(1)
            mp4 = MP4_ATTR.search(attrs)
            w = WIDTH_ATTR.search(attrs)
            h = HEIGHT_ATTR.search(attrs)
            if mp4:
                videos.append({
                    "url": mp4.group(1),
                    "width": int(w.group(1)) if w else 0,
                    "height": int(h.group(1)) if h else 0,
                })
        clean = VIDEO_PATTERN_ALT.sub("", raw).strip()
    except Exception:
        clean = raw
    return clean, videos


def to_decimal(value: str, default=None) -> Decimal | None:
    try:
        return Decimal(value.strip()) if value.strip() else default
    except InvalidOperation:
        return default


def parse_image_urls(raw: str) -> list[str]:
    return [u.strip() for u in raw.split(",") if u.strip()]


def normalize_tag(tag: str) -> str:
    return tag.strip().lower()


class Command(BaseCommand):
    help = "从 WP 导出 CSV 批量导入商品到 Vaultcare ERP"

    def add_arguments(self, parser):
        parser.add_argument("--csv", dest="csv_path", default=str(DEFAULT_CSV), help="CSV 文件路径")
        parser.add_argument("--wp-site-id", dest="wp_site_id", type=int, default=None, help="主站 WPSite ID（不填则跳过 WPProductMapping 创建）")
        parser.add_argument("--dry-run", action="store_true", help="试运行，不写入数据库")
        parser.add_argument("--region", default="u", help="区域码，默认 u (UAE)")

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"])
        if not csv_path.exists():
            raise CommandError(f"CSV 文件不存在：{csv_path}")

        dry_run = options["dry_run"]
        region = options["region"]
        wp_site_id = options["wp_site_id"]
        wp_site = None

        if wp_site_id:
            try:
                wp_site = WPSite.objects.get(pk=wp_site_id)
                self.stdout.write(f"主站：{wp_site}")
            except WPSite.DoesNotExist:
                raise CommandError(f"WPSite ID={wp_site_id} 不存在")

        # 预加载 Category / OperationalTag 映射
        categories = {c.code: c for c in Category.objects.all()}
        op_tags = {t.name: t for t in OperationalTag.objects.all()}

        stats = {"created": 0, "skipped": 0, "uncategorized": [], "errors": []}

        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = [r for r in reader if r.get("Type", "").strip() in ("simple", "")]

        self.stdout.write(f"读取到 {len(rows)} 条 simple 商品行")
        if dry_run:
            self.stdout.write(self.style.WARNING("【试运行模式】不会写入数据库"))

        with transaction.atomic():
            for row in rows:
                try:
                    result = self._process_row(row, region, categories, op_tags, wp_site, dry_run, stats)
                    if result:
                        stats["created"] += 1
                    else:
                        stats["skipped"] += 1
                except Exception as e:
                    sku = row.get("SKU", "?")
                    stats["errors"].append(f"SKU={sku}: {e}")
                    self.stderr.write(self.style.ERROR(f"  [ERR] SKU={sku}: {e}"))

            if dry_run:
                transaction.set_rollback(True)

        self._print_summary(stats)

    def _process_row(self, row, region, categories, op_tags, wp_site, dry_run, stats):
        wp_id_raw = row.get("ID", "").strip()
        sku = row.get("SKU", "").strip()
        name = row.get("Name", "").strip()

        if not sku:
            self.stdout.write(self.style.WARNING(f"  跳过：SKU 为空（ID={wp_id_raw}，名称={name}）"))
            return False

        # 检查是否已存在（幂等）
        if MasterSKU.objects.filter(legacy_code=sku).exists():
            self.stdout.write(f"  已存在（legacy_code={sku}），跳过")
            return False

        # --- 分类处理 ---
        raw_cats = [c.strip() for c in row.get("Categories", "").split(",") if c.strip()]
        primary_cat = None
        extra_cats = []

        for cat_name in raw_cats:
            norm = cat_name.lower()
            if norm == "uncategorized":
                stats["uncategorized"].append(sku)
                continue
            code = CATEGORY_MAP.get(norm)
            if code is None:
                code = "9"  # 其他杂类
            cat_obj = categories.get(code)
            if cat_obj:
                if primary_cat is None:
                    primary_cat = cat_obj
                else:
                    extra_cats.append(cat_obj)

        # --- Tags 处理 ---
        raw_tags = [t.strip() for t in row.get("Tags", "").split(",") if t.strip()]
        audience_tags_val = []
        operational_tags_to_add = []

        for tag in raw_tags:
            norm = normalize_tag(tag)
            if norm in AUDIENCE_TAGS:
                clean = norm.replace(" ", "_")
                if clean not in audience_tags_val:
                    audience_tags_val.append(clean)
            elif norm in OPERATIONAL_TAG_NAMES:
                clean = norm.replace(" ", "_")
                op_obj = op_tags.get(clean)
                if op_obj:
                    operational_tags_to_add.append(op_obj)

        # --- 价格 ---
        regular_price = to_decimal(row.get("Regular price", ""))
        selling_price = to_decimal(row.get("Sale price", "")) or regular_price

        # --- 描述与视频 ---
        raw_desc = row.get("Description", "")
        clean_desc, videos = parse_description(raw_desc)

        # --- 图片 ---
        image_urls = parse_image_urls(row.get("Images", ""))

        # --- 其他字段 ---
        is_active = row.get("Published", "0").strip() == "1"
        is_featured = row.get("Is featured?", "0").strip() == "1"
        short_desc = row.get("Short description", "").strip()
        wp_product_id = int(wp_id_raw) if wp_id_raw.isdigit() else None

        self.stdout.write(
            f"  {'[DRY]' if dry_run else '+'} {sku} | {name[:40]} | cat={primary_cat} | AED {selling_price}"
        )

        if not dry_run:
            sku_obj = MasterSKU.objects.create(
                master_code=sku,
                legacy_code=sku,
                title_en=name,
                title_ar="",
                short_description=short_desc,
                description=clean_desc,
                image_urls=image_urls,
                video_urls=videos,
                regular_price=regular_price,
                selling_price=selling_price or Decimal("0.01"),
                region=region,
                is_active=is_active,
                is_featured=is_featured,
                primary_category=primary_cat,
                audience_tags=audience_tags_val,
            )
            if extra_cats:
                sku_obj.categories.set(extra_cats)
            if operational_tags_to_add:
                sku_obj.operational_tags.set(operational_tags_to_add)

            if wp_site and wp_product_id:
                WPProductMapping.objects.update_or_create(
                    master_sku=sku_obj,
                    wp_site=wp_site,
                    defaults={
                        "wp_product_id": wp_product_id,
                        "wp_sku": sku,
                        "sync_status": "synced" if is_active else "draft",
                    },
                )

        return True

    def _print_summary(self, stats):
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS(f"  导入完成：新建 {stats['created']} 条"))
        self.stdout.write(f"  跳过（已存在）：{stats['skipped']} 条")
        if stats["uncategorized"]:
            self.stdout.write(self.style.WARNING(
                f"  [!] {len(stats['uncategorized'])} SKUs with Uncategorized (need manual assignment):\n"
                + "    " + ", ".join(stats["uncategorized"])
            ))
        if stats["errors"]:
            self.stdout.write(self.style.ERROR(f"  [ERR] {len(stats['errors'])} errors:"))
            for e in stats["errors"]:
                self.stdout.write(self.style.ERROR(f"    {e}"))
        self.stdout.write("=" * 60)
