"""
飞轮进化数据收集器
收集意图使用、Bug 状态、文档更新等指标，用于持续改进人机协作体系
"""

import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any


class FlywheelCollector:
    """飞轮数据收集器"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = Path(__file__).parent.parent.parent
        self.base_dir = Path(base_dir)
        self.docs_dir = self.base_dir / "docs"
        self.flywheel_dir = self.docs_dir / "flywheel"
        self.status_dir = self.docs_dir / "status"
        self.roundtable_dir = self.docs_dir / "roundtable"

        # 确保目录存在
        self.flywheel_dir.mkdir(parents=True, exist_ok=True)

        # 意图列表（来自 INTENTS-GUIDE.md）
        self.intents = {
            "core": ["/启动", "/开发", "/Bug", "/圆桌", "/审查", "/测试", "/文档", "/进度"],
            "auxiliary": ["/解释", "/调试", "/重构", "/提问", "/检查"],
            "special": ["/部署", "/总结", "//意图"]
        }

    def collect_intent_usage(self) -> Dict[str, Any]:
        """
        收集意图使用频率
        扫描 docs/roundtable/sessions/ 目录下的会话文件
        """
        sessions_dir = self.roundtable_dir / "sessions"
        intent_counts = {intent: 0 for category in self.intents.values() for intent in category}
        intent_details = {intent: [] for category in self.intents.values() for intent in category}

        if not sessions_dir.exists():
            sessions_dir.mkdir(parents=True, exist_ok=True)
            return {
                "total_sessions": 0,
                "intent_counts": intent_counts,
                "intent_details": intent_details
            }

        # 扫描所有会话文件
        session_files = list(sessions_dir.glob("*.md"))

        for session_file in session_files:
            try:
                content = session_file.read_text(encoding='utf-8')

                # 提取意图使用
                for intent in intent_counts.keys():
                    # 匹配意图词（支持别名）
                    pattern = rf'(?:^|\s)({re.escape(intent)})\s'
                    matches = re.findall(pattern, content, re.MULTILINE)
                    if matches:
                        intent_counts[intent] += len(matches)
                        intent_details[intent].append({
                            "file": session_file.name,
                            "count": len(matches)
                        })

            except Exception as e:
                print(f"Error reading {session_file}: {e}")

        return {
            "total_sessions": len(session_files),
            "intent_counts": intent_counts,
            "intent_details": {k: v for k, v in intent_details.items() if v}  # 只保留有使用的
        }

    def collect_bug_stats(self) -> Dict[str, Any]:
        """
        收集 Bug 统计数据
        从 current-status.md 中提取 Bug 列表
        """
        status_file = self.status_dir / "current-status.md"

        bug_stats = {
            "P0": 0,
            "P1": 0,
            "P2": 0,
            "P3": 0,
            "total": 0,
            "fixed": 0,
            "bugs": []
        }

        if not status_file.exists():
            return bug_stats

        try:
            content = status_file.read_text(encoding='utf-8')

            # 匹配 Bug 条目
            # 格式：- [ ] Bug-01：描述 或 - [x] Bug-01：描述
            bug_pattern = r'- \[([ x])\]\s+(Bug-\d+|🔴|🟠|🟡|⚪)\s*([^:\n]+)'

            current_priority = None
            for line in content.split('\n'):
                # 检测优先级段落
                if '🔴 P0' in line or 'P0（阻断）' in line:
                    current_priority = 'P0'
                elif '🟠 P1' in line or 'P1（功能错误）' in line:
                    current_priority = 'P1'
                elif '🟡 P2' in line:
                    current_priority = 'P2'
                elif '⚪ P3' in line:
                    current_priority = 'P3'

                # 匹配 Bug
                match = re.search(bug_pattern, line)
                if match:
                    status_char = match.group(1)
                    bug_id = match.group(2)
                    description = match.group(3).strip()

                    is_fixed = status_char.lower() == 'x'

                    bug_info = {
                        "id": bug_id,
                        "description": description,
                        "priority": current_priority,
                        "status": "fixed" if is_fixed else "open"
                    }

                    bug_stats["bugs"].append(bug_info)

                    if current_priority:
                        bug_stats[current_priority] += 1
                    bug_stats["total"] += 1

                    if is_fixed:
                        bug_stats["fixed"] += 1

        except Exception as e:
            print(f"Error reading status file: {e}")

        return bug_stats

    def collect_doc_updates(self) -> Dict[str, Any]:
        """
        收集文档更新记录
        扫描 docs/ 目录下所有 markdown 文件的修改时间
        """
        doc_stats = {
            "total_docs": 0,
            "updated_today": 0,
            "updated_this_week": 0,
            "updated_this_month": 0,
            "recent_updates": [],
            "by_category": {}
        }

        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        this_week = today - timedelta(days=today.weekday())
        this_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # 分类目录
        categories = {
            "status": self.status_dir,
            "roundtable": self.roundtable_dir,
            "flywheel": self.flywheel_dir,
            "modules": self.docs_dir / "modules",
            "context": self.docs_dir / "context",
            "archive": self.docs_dir / "archive"
        }

        # 扫描所有 markdown 文件
        md_files = list(self.docs_dir.rglob("*.md"))
        doc_stats["total_docs"] = len(md_files)

        for md_file in md_files:
            try:
                mtime = datetime.fromtimestamp(md_file.stat().st_mtime)
                rel_path = md_file.relative_to(self.docs_dir)

                update_info = {
                    "file": str(rel_path),
                    "mtime": mtime.isoformat(),
                    "mtime_display": mtime.strftime("%Y-%m-%d %H:%M")
                }

                if mtime >= today:
                    doc_stats["updated_today"] += 1
                    doc_stats["updated_this_week"] += 1
                    doc_stats["updated_this_month"] += 1
                    doc_stats["recent_updates"].insert(0, update_info)
                elif mtime >= this_week:
                    doc_stats["updated_this_week"] += 1
                    doc_stats["updated_this_month"] += 1
                    doc_stats["recent_updates"].insert(0, update_info)
                elif mtime >= this_month:
                    doc_stats["updated_this_month"] += 1
                    doc_stats["recent_updates"].insert(0, update_info)

                # 按分类统计
                for cat_name, cat_dir in categories.items():
                    try:
                        if cat_dir in md_file.parents or md_file.parent == cat_dir:
                            if cat_name not in doc_stats["by_category"]:
                                doc_stats["by_category"][cat_name] = 0
                            doc_stats["by_category"][cat_name] += 1
                            break
                    except:
                        pass

            except Exception as e:
                print(f"Error reading {md_file}: {e}")

        # 只保留最近的 20 条更新
        doc_stats["recent_updates"] = doc_stats["recent_updates"][:20]

        return doc_stats

    def generate_metrics(self) -> Dict[str, Any]:
        """生成完整的指标数据"""
        now = datetime.now()

        metrics = {
            "metadata": {
                "collected_at": now.isoformat(),
                "week_number": now.isocalendar()[1],
                "month": now.month,
                "year": now.year
            },
            "intent_usage": self.collect_intent_usage(),
            "bug_stats": self.collect_bug_stats(),
            "doc_updates": self.collect_doc_updates()
        }

        # 计算摘要
        metrics["summary"] = self._calculate_summary(metrics)

        return metrics

    def _calculate_summary(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """计算摘要信息"""
        intent_usage = metrics["intent_usage"]
        bug_stats = metrics["bug_stats"]
        doc_updates = metrics["doc_updates"]

        # 最常用的意图
        intent_counts = intent_usage["intent_counts"]
        most_used_intent = max(intent_counts, key=intent_counts.get) if intent_counts else None
        most_used_count = intent_counts.get(most_used_intent, 0) if most_used_intent else 0

        # Bug 修复率
        bug_fix_rate = 0
        if bug_stats["total"] > 0:
            bug_fix_rate = round(bug_stats["fixed"] / bug_stats["total"] * 100, 1)

        # 文档活跃度
        doc_active_rate = 0
        if doc_updates["total_docs"] > 0:
            doc_active_rate = round(
                (doc_updates["updated_this_week"] / doc_updates["total_docs"]) * 100, 1
            )

        return {
            "most_used_intent": most_used_intent,
            "most_used_intent_count": most_used_count,
            "total_intents_used": sum(intent_counts.values()),
            "bug_fix_rate": bug_fix_rate,
            "open_bugs": bug_stats["total"] - bug_stats["fixed"],
            "doc_active_rate": doc_active_rate,
            "docs_updated_this_week": doc_updates["updated_this_week"]
        }

    def save_metrics(self, metrics: Dict[str, Any] = None) -> str:
        """保存指标到 JSON 文件"""
        if metrics is None:
            metrics = self.generate_metrics()

        now = datetime.now()
        filename = f"metrics-{now.year}-{now.month:02d}.json"
        filepath = self.flywheel_dir / filename

        # 如果文件已存在，追加到数组中
        existing_data = []
        if filepath.exists():
            try:
                existing_data = json.loads(filepath.read_text(encoding='utf-8'))
                if not isinstance(existing_data, list):
                    existing_data = [existing_data]
            except:
                existing_data = []

        existing_data.append(metrics)

        filepath.write_text(json.dumps(existing_data, ensure_ascii=False, indent=2), encoding='utf-8')

        return str(filepath)

    def generate_markdown_report(self, metrics: Dict[str, Any] = None) -> str:
        """生成 Markdown 格式报告"""
        if metrics is None:
            metrics = self.generate_metrics()

        summary = metrics["summary"]
        intent_usage = metrics["intent_usage"]
        bug_stats = metrics["bug_stats"]
        doc_updates = metrics["doc_updates"]
        collected_at = metrics["metadata"]["collected_at"][:10]

        report = f"""# 飞轮进化周报

**报告周期**: 第 {metrics["metadata"]["week_number"]} 周 ({collected_at})
**生成时间**: {collected_at}

---

## 📊 核心指标摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| 最常用意图 | `{summary["most_used_intent"] or "无数据"}` | 使用 {summary["most_used_intent_count"]} 次 |
| 意图总使用次数 | {summary["total_intents_used"]} | 所有意图加起来 |
| Bug 修复率 | {summary["bug_fix_rate"]}% | 已修复/{summary["open_bugs"] + summary["bug_fix_rate"] * 100 / (100 - summary["bug_fix_rate"]) if summary["bug_fix_rate"] < 100 else summary["open_bugs"]} 个 |
| 待修复 Bug | {summary["open_bugs"]} 个 | P0/P1 优先处理 |
| 文档活跃度 | {summary["doc_active_rate"]}% | 本周更新 {summary["docs_updated_this_week"]} 个文件 |

---

## 🎯 意图使用情况

### 按类别统计

| 类别 | 意图 | 使用次数 |
|------|------|----------|
"""

        # 核心意图
        for intent in self.intents["core"]:
            count = intent_usage["intent_counts"].get(intent, 0)
            if count > 0:
                report += f"| 核心意图 | `{intent}` | {count} |\n"

        # 辅助意图
        for intent in self.intents["auxiliary"]:
            count = intent_usage["intent_counts"].get(intent, 0)
            if count > 0:
                report += f"| 辅助意图 | `{intent}` | {count} |\n"

        # 特殊意图
        for intent in self.intents["special"]:
            count = intent_usage["intent_counts"].get(intent, 0)
            if count > 0:
                report += f"| 特殊意图 | `{intent}` | {count} |\n"

        report += f"""
### 会话统计
- 总会话数：{intent_usage["total_sessions"]}
- 有意图使用的会话：{len(intent_usage["intent_details"])}

---

## 🐛 Bug 统计

### 按优先级分布

| 优先级 | 数量 | 状态 |
|--------|------|------|
| 🔴 P0 | {bug_stats["P0"]} | 阻断性问题 |
| 🟠 P1 | {bug_stats["P1"]} | 功能错误 |
| 🟡 P2 | {bug_stats["P2"]} | 次要问题 |
| ⚪ P3 | {bug_stats["P3"]} | 建议优化 |
| **总计** | **{bug_stats["total"]}** | 修复率 **{summary["bug_fix_rate"]}%** |

### 待修复 Bug 列表

"""

        open_bugs = [b for b in bug_stats["bugs"] if b["status"] == "open"]
        if open_bugs:
            for bug in open_bugs[:10]:  # 只显示前 10 个
                priority_icon = {"P0": "🔴", "P1": "🟠", "P2": "🟡", "P3": "⚪"}.get(bug["priority"], "⚪")
                report += f"- {priority_icon} [{bug["priority"]}] {bug["id"]}: {bug["description"]}\n"
            if len(open_bugs) > 10:
                report += f"- ... 还有 {len(open_bugs) - 10} 个 Bug\n"
        else:
            report += "暂无待修复 Bug 🎉\n"

        report += f"""
---

## 📄 文档更新

### 更新统计

| 时间范围 | 更新数量 |
|----------|----------|
| 今日 | {doc_updates["updated_today"]} |
| 本周 | {doc_updates["updated_this_week"]} |
| 本月 | {doc_updates["updated_this_month"]} |
| 总计 | {doc_updates["total_docs"]} |

### 按类别分布

| 类别 | 文件数 |
|------|--------|
"""

        for cat, count in doc_updates["by_category"].items():
            report += f"| {cat} | {count} |\n"

        report += f"""
### 最近更新的文档

"""

        if doc_updates["recent_updates"]:
            for update in doc_updates["recent_updates"][:10]:
                report += f"- `{update["file"]}` - {update["mtime_display"]}\n"
        else:
            report += "本周无文档更新\n"

        report += f"""
---

## 💡 改进建议

"""

        # 根据数据生成建议
        suggestions = []

        if summary["most_used_intent"] == "/Bug":
            suggestions.append("- ⚠️ Bug 报告频率较高，建议分析常见 Bug 类型，从源头减少问题")

        if summary["bug_fix_rate"] < 50:
            suggestions.append("- 🔴 Bug 修复率低于 50%，建议优先处理 P0/P1 Bug")

        if summary["doc_active_rate"] < 20:
            suggestions.append("- 📄 文档活跃度较低，建议代码变更后及时更新文档")

        if summary["total_intents_used"] < 5:
            suggestions.append("- 📉 意图使用频率低，建议多使用 `/启动` `/开发` `/Bug` 等核心意图")

        if not suggestions:
            suggestions.append("- ✅ 各项指标正常，继续保持")

        report += "\n".join(suggestions)

        report += f"""

---

## 📈 趋势分析

> 持续收集数据后，将在这里显示周环比、月环比趋势

"""

        return report

    def save_markdown_report(self, report: str = None, metrics: Dict[str, Any] = None) -> str:
        """保存 Markdown 报告到文件"""
        if report is None:
            metrics = self.generate_metrics()
            report = self.generate_markdown_report(metrics)

        now = datetime.now()
        filename = f"weekly-report-{now.year}-W{now.isocalendar()[1]:02d}.md"
        filepath = self.flywheel_dir / filename

        filepath.write_text(report, encoding='utf-8')

        return str(filepath)

    def run(self) -> Dict[str, str]:
        """执行完整的数据收集和报告生成流程"""
        # 生成指标
        metrics = self.generate_metrics()

        # 保存 JSON
        json_path = self.save_metrics(metrics)

        # 生成并保存 Markdown 报告
        report = self.generate_markdown_report(metrics)
        md_path = self.save_markdown_report(report)

        return {
            "json_path": json_path,
            "markdown_path": md_path,
            "summary": metrics["summary"]
        }


# 命令行入口
if __name__ == "__main__":
    collector = FlywheelCollector()
    result = collector.run()

    print("=== 飞轮进化数据收集完成 ===\n")
    print(f"JSON 数据：{result['json_path']}")
    print(f"Markdown 报告：{result['markdown_path']}")
    print(f"\n核心指标:")
    for key, value in result['summary'].items():
        print(f"  {key}: {value}")
