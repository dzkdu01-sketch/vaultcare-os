"""
Django 管理命令：飞轮进化数据收集
用法：python manage.py flywheel_report
"""

import sys
import os

# 添加 flywheel 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'flywheel'))

from django.core.management.base import BaseCommand
from collector import FlywheelCollector


class Command(BaseCommand):
    help = '收集飞轮进化数据并生成报告'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json-only',
            action='store_true',
            help='只生成 JSON 数据，不生成 Markdown 报告'
        )
        parser.add_argument(
            '--output',
            type=str,
            help='指定输出目录'
        )

    def handle(self, *args, **options):
        self.stdout.write('=== 飞轮进化数据收集 ===\n')

        collector = FlywheelCollector()
        result = collector.run()

        self.stdout.write(self.style.SUCCESS('✓ 数据收集完成\n'))
        self.stdout.write(f'JSON 数据：{result["json_path"]}\n')
        self.stdout.write(f'Markdown 报告：{result["markdown_path"]}\n')

        self.stdout.write('\n核心指标:\n')
        for key, value in result['summary'].items():
            self.stdout.write(f'  - {key}: {value}')

        return result
