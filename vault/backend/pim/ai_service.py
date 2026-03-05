"""
pim/ai_service.py — Claude API 封装

功能：
- 图片分析 → 自动填写商品字段（analyze_product_images）
- 阿拉伯语标题/描述生成（generate_arabic_content）

配置：
    CLAUDE_API_KEY 环境变量 或 settings.CLAUDE_API_KEY
    使用模型：claude-3-5-haiku-20241022（速度快，成本低）
"""

import base64
import json
import logging
import re
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


def _get_model_config():
    """从数据库获取模型配置"""
    try:
        from .models import AIConfig
        config = AIConfig.get_config()
        return config.primary_model, config.max_retries, config.enable_fallback
    except Exception:
        # 降级默认值
        return "claude-3-5-haiku-20241022", 2, True


# 默认值（配置不可用时使用）
DEFAULT_MODEL = "claude-3-5-haiku-20241022"
DEFAULT_MAX_RETRIES = 2
CANONICAL_CATEGORIES = [
    "Vibrators",
    "Dildo",
    "Butt Plugs",
    "Masturbators",
    "Cock Rings & Enhancers",
    "med",
    "Half Body Sex Doll",
    "Full Body Sex Doll",
    "other",
    "Strap-Ons",
]

SYSTEM_PROMPT = """\
You are a product content specialist for an adult wellness e-commerce brand
called Vaultcare, selling in the UAE market. Write SEO-friendly, tasteful
product listings that comply with marketplace guidelines.

Return ONLY a valid JSON object with these exact fields:
- title_en: string, max 80 chars
- title_ar: string, Arabic (Gulf dialect preferred)
- short_description: string, max 150 chars
- description: string, 200-350 words, structured with line breaks
- primary_category: one of [Vibrators|Dildo|Butt Plugs|Masturbators|Cock Rings & Enhancers|med|Half Body Sex Doll|Full Body Sex Doll|other|Strap-Ons]
- audience_tags: array, subset of ["for_her","for_him","for_couples"]
- operational_tags: array, subset of ["best_seller","high_value","new_arrival"]
- confidence_score: float 0.0 to 1.0
- notes: string, flag any uncertainty or issues
"""

ARABIC_SYSTEM_PROMPT = """\
You are a bilingual copywriter specializing in Arabic content for UAE adult
wellness e-commerce. Translate and adapt product titles and descriptions
into natural Gulf Arabic (العربية الخليجية).

Return ONLY a valid JSON object with these fields:
- title_ar: string, Arabic translation of the title (max 80 chars)
- short_description_ar: string, Arabic short description (max 150 chars)
- quality_score: float 0.0 to 1.0 (1.0 = perfect natural Gulf Arabic)
- dialect_notes: string, notes on dialect choices or uncertain terms
"""


def _get_client():
    """惰性初始化 Anthropic 客户端。"""
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic SDK 未安装，请运行: pip install anthropic>=0.40")

    api_key = getattr(settings, 'CLAUDE_API_KEY', '') or ''
    if not api_key:
        raise RuntimeError(
            "CLAUDE_API_KEY 未配置。请设置环境变量 CLAUDE_API_KEY 或在 settings.py 中配置。"
        )
    return anthropic.Anthropic(api_key=api_key)


def _strip_json_fences(text: str) -> str:
    """剥离 ```json ... ``` 包裹，提取纯 JSON 字符串。"""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
    if match:
        return match.group(1).strip()
    # 直接查找第一个 { 到最后一个 }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end + 1]
    return text


def _normalize_primary_category(value) -> str:
    if not isinstance(value, str):
        return "other"

    normalized = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    if not normalized:
        return "other"

    aliases = {
        "vibrator": "Vibrators",
        "vibrators": "Vibrators",
        "dildo": "Dildo",
        "dildos": "Dildo",
        "butt plug": "Butt Plugs",
        "butt plugs": "Butt Plugs",
        "buttplay": "Butt Plugs",
        "masturbator": "Masturbators",
        "masturbators": "Masturbators",
        "cock ring enhancers": "Cock Rings & Enhancers",
        "cock rings enhancers": "Cock Rings & Enhancers",
        "cock rings and enhancers": "Cock Rings & Enhancers",
        "cock rings": "Cock Rings & Enhancers",
        "med": "med",
        "half body sex doll": "Half Body Sex Doll",
        "full body sex doll": "Full Body Sex Doll",
        "other": "other",
        "strap ons": "Strap-Ons",
        "strap on": "Strap-Ons",
        "strapons": "Strap-Ons",
    }

    if normalized in aliases:
        return aliases[normalized]

    for canonical in CANONICAL_CATEGORIES:
        if normalized == re.sub(r"[^a-z0-9]+", " ", canonical.lower()).strip():
            return canonical
    return "other"


def _call_with_retry(client, model: str = None, max_retries: int = None, **kwargs) -> str:
    """调用 Claude API，失败最多重试 max_retries 次。"""
    # 从配置获取模型和重试次数
    if model is None or max_retries is None:
        model, max_retries, _ = _get_model_config()

    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            # 使用配置的模型
            if model:
                kwargs['model'] = model
            response = client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as exc:
            last_exc = exc
            logger.warning("Claude API attempt %d/%d failed: %s", attempt + 1, max_retries + 1, exc)
    raise RuntimeError(f"Claude API 调用失败（{max_retries + 1} 次）: {last_exc}") from last_exc


def _encode_image(image_data: bytes, media_type: str) -> dict:
    """将图片字节编码为 Claude API 的 image source 格式。"""
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(image_data).decode("utf-8"),
        },
    }


def _detect_media_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".gif":  "image/gif",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")


# ---------------------------------------------------------------------------
# 公开接口
# ---------------------------------------------------------------------------

def analyze_product_images(images: list[dict]) -> dict:
    """
    分析 1-5 张商品图片，返回建议字段。

    Args:
        images: 列表，每项为 {'filename': str, 'data': bytes}

    Returns:
        包含 title_en / title_ar / short_description / description /
        primary_category / audience_tags / operational_tags /
        confidence_score / notes 的字典。
    """
    if not images:
        raise ValueError("至少需要上传 1 张图片")
    if len(images) > 5:
        raise ValueError("最多支持 5 张图片")

    client = _get_client()

    content = []
    for img in images:
        media_type = _detect_media_type(img.get('filename', 'image.jpg'))
        content.append(_encode_image(img['data'], media_type))

    content.append({
        "type": "text",
        "text": "Analyze these product images and return the JSON fields as instructed.",
    })

    model, max_retries, _ = _get_model_config()
    raw = _call_with_retry(
        client,
        model=model,
        max_retries=max_retries,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    try:
        result = json.loads(_strip_json_fences(raw))
    except json.JSONDecodeError as exc:
        logger.error("Claude returned non-JSON: %s", raw[:500])
        raise RuntimeError(f"AI 返回格式错误，无法解析 JSON: {exc}") from exc

    # 字段完整性补全（防止模型漏字段）
    result.setdefault('title_en', '')
    result.setdefault('title_ar', '')
    result.setdefault('short_description', '')
    result.setdefault('description', '')
    result.setdefault('primary_category', 'other')
    result.setdefault('audience_tags', [])
    result.setdefault('operational_tags', [])
    result.setdefault('confidence_score', 0.5)
    result.setdefault('notes', '')
    result['primary_category'] = _normalize_primary_category(result.get('primary_category'))

    return result


def generate_arabic_content(title_en: str, description: str = '') -> dict:
    """
    根据英文标题和描述生成阿拉伯语版本。

    Returns:
        包含 title_ar / short_description_ar / quality_score / dialect_notes 的字典。
    """
    if not title_en.strip():
        raise ValueError("title_en 不能为空")

    client = _get_client()

    user_text = f"Product title (English): {title_en}"
    if description.strip():
        user_text += f"\n\nProduct description (English):\n{description[:800]}"

    model, max_retries, _ = _get_model_config()
    raw = _call_with_retry(
        client,
        model=model,
        max_retries=max_retries,
        max_tokens=800,
        system=ARABIC_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )

    try:
        result = json.loads(_strip_json_fences(raw))
    except json.JSONDecodeError as exc:
        logger.error("Claude arabic returned non-JSON: %s", raw[:500])
        raise RuntimeError(f"AI 返回格式错误: {exc}") from exc

    result.setdefault('title_ar', '')
    result.setdefault('short_description_ar', '')
    result.setdefault('quality_score', 0.5)
    result.setdefault('dialect_notes', '')

    return result


# ---------------------------------------------------------------------------
# Task 3: OCR 识别和文案优化
# ---------------------------------------------------------------------------

OCR_SYSTEM_PROMPT = """
You are an OCR and product data extraction specialist for Vaultcare,
an e-commerce brand selling in the UAE.

Extract product information from images and return a valid JSON object:
- title_en: string (max 80 chars, SEO-friendly)
- title_ar: string (Arabic translation)
- short_description: string (max 150 chars)
- description: string (200-350 words, structured)
- primary_category: one of [Vibrators|Dildo|Butt Plugs|Masturbators|Cock Rings & Enhancers|med|Half Body Sex Doll|Full Body Sex Doll|other|Strap-Ons]
- audience_tags: array from ["for_her","for_him","for_couples"]
- confidence_score: float (0-1)
- notes: string (any uncertainties)
"""

TEXT_OPTIMIZE_SYSTEM_PROMPT = """
You are an e-commerce copywriting expert specializing in adult wellness
products for the UAE market.

Optimize product titles and descriptions to be:
- SEO-friendly with relevant keywords
- Clear, compelling, and tasteful
- Compliant with UAE marketplace guidelines
- Persuasive without being explicit

Return a JSON object:
- original: {title_en: str, description: str}
- optimized: {title_en: str, description: str}
- improvements: array of strings (what was improved)
- quality_score: float (0-1)
"""


def ocr_analyze(images: list) -> dict:
    """
    OCR 识别图片，返回建议字段

    Args:
        images: Django UploadedFile 列表

    Returns:
        {
            'title_en': str,
            'title_ar': str,
            'short_description': str,
            'description': str,
            'primary_category': str,
            'audience_tags': list,
            'confidence_score': float,
            'notes': str,
        }
    """
    client = _get_client()
    model, max_retries, _ = _get_model_config()

    content = []
    for img in images[:5]:  # 限制最多 5 张
        from django.core.files.uploadedfile import UploadedFile
        if isinstance(img, UploadedFile):
            data = img.read()
            filename = img.name
        elif isinstance(img, dict) and 'data' in img:
            data = img['data']
            filename = img.get('filename', 'image.jpg')
        else:
            continue

        media_type = _detect_media_type(filename)
        content.append(_encode_image(data, media_type))

    content.append({
        "type": "text",
        "text": "Extract product information from these images and return JSON as instructed.",
    })

    raw = _call_with_retry(
        client,
        model=model,
        max_retries=max_retries,
        max_tokens=1500,
        system=OCR_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    try:
        result = json.loads(_strip_json_fences(raw))
    except json.JSONDecodeError as exc:
        logger.error("OCR returned non-JSON: %s", raw[:500])
        raise RuntimeError(f"AI 返回格式错误：{exc}") from exc

    # 字段兜底
    result.setdefault('title_en', '')
    result.setdefault('title_ar', '')
    result.setdefault('short_description', '')
    result.setdefault('description', '')
    result.setdefault('primary_category', 'other')
    result.setdefault('audience_tags', [])
    result.setdefault('confidence_score', 0.5)
    result.setdefault('notes', '')
    result['primary_category'] = _normalize_primary_category(result.get('primary_category'))

    return result


def optimize_text(title_en: str, description: str = '') -> dict:
    """
    优化英文标题和描述

    Args:
        title_en: 英文标题
        description: 英文描述（可选）

    Returns:
        {
            'original': {'title_en': str, 'description': str},
            'optimized': {'title_en': str, 'description': str},
            'improvements': list,
            'quality_score': float,
        }
    """
    if not title_en.strip():
        raise ValueError("title_en 不能为空")

    client = _get_client()
    model, max_retries, _ = _get_model_config()

    user_text = f"Product title (English): {title_en}"
    if description.strip():
        user_text += f"\n\nProduct description (English):\n{description[:800]}"

    raw = _call_with_retry(
        client,
        model=model,
        max_retries=max_retries,
        max_tokens=800,
        system=TEXT_OPTIMIZE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )

    try:
        result = json.loads(_strip_json_fences(raw))
    except json.JSONDecodeError as exc:
        logger.error("Text optimize returned non-JSON: %s", raw[:500])
        raise RuntimeError(f"AI 返回格式错误：{exc}") from exc

    # 兜底处理
    result.setdefault('original', {'title_en': title_en, 'description': description})
    result.setdefault('optimized', {'title_en': title_en, 'description': description})
    result.setdefault('improvements', [])
    result.setdefault('quality_score', 0.5)

    # 确保 original 字段完整
    if 'original' not in result or not isinstance(result['original'], dict):
        result['original'] = {'title_en': title_en, 'description': description}
    else:
        result['original'].setdefault('title_en', title_en)
        result['original'].setdefault('description', description)

    # 确保 optimized 字段完整
    if 'optimized' not in result or not isinstance(result['optimized'], dict):
        result['optimized'] = {'title_en': title_en, 'description': description}
    else:
        result['optimized'].setdefault('title_en', title_en)
        result['optimized'].setdefault('description', description)

    return result
