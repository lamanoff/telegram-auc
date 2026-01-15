#!/usr/bin/env python3
"""
Скрипт запуска Selenium тестов с автоматической подготовкой окружения.

Использование:
    python run_tests.py                    # Все тесты
    python run_tests.py --smoke            # Только smoke тесты
    python run_tests.py --headless         # Headless режим
    python run_tests.py -k test_login      # Тесты по паттерну
    python run_tests.py --no-auto-setup    # Без автозапуска сервисов
"""
import os
import sys
import argparse
import subprocess
from pathlib import Path


def main():
    # Используем тот же Python интерпретатор, который запустил этот скрипт
    python_executable = sys.executable
    
    parser = argparse.ArgumentParser(
        description="Запуск Selenium тестов CryptoAuction Platform",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  python run_tests.py                      # Все тесты с автозапуском сервисов
  python run_tests.py --smoke              # Только smoke тесты
  python run_tests.py --headless           # Headless режим браузера
  python run_tests.py --browser firefox    # Использовать Firefox
  python run_tests.py -k "test_login"      # Только тесты с 'test_login' в имени
  python run_tests.py --no-auto-setup      # Не запускать сервисы автоматически
  python run_tests.py --html report.html   # Генерация HTML отчёта
        """
    )
    
    # Основные опции
    parser.add_argument(
        "--smoke", "-s",
        action="store_true",
        help="Запустить только smoke тесты"
    )
    parser.add_argument(
        "--regression", "-r",
        action="store_true",
        help="Запустить regression тесты"
    )
    parser.add_argument(
        "--browser", "-b",
        choices=["chrome", "firefox", "edge"],
        default="chrome",
        help="Браузер для тестов (по умолчанию: chrome)"
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Запустить браузер в headless режиме"
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("BASE_URL", "http://localhost:8080"),
        help="URL фронтенда (в Docker: 8080)"
    )
    parser.add_argument(
        "--api-url",
        default=os.getenv("API_URL", "http://localhost:3000"),
        help="URL бэкенда"
    )
    
    # Опции автозапуска
    parser.add_argument(
        "--no-auto-setup",
        action="store_true",
        help="Отключить автоматический запуск docker-compose"
    )
    parser.add_argument(
        "--no-docker",
        action="store_true",
        help="Не запускать docker-compose автоматически"
    )
    parser.add_argument(
        "--no-auto-users",
        action="store_true",
        help="Не создавать тестовых пользователей"
    )
    parser.add_argument(
        "--keep-containers",
        action="store_true",
        help="Не останавливать контейнеры после тестов"
    )
    parser.add_argument(
        "--reuse-browser",
        action="store_true",
        help="Переиспользовать браузер между тестами (быстрее)"
    )
    
    # Опции pytest
    parser.add_argument(
        "-k",
        dest="keyword",
        help="Фильтр тестов по ключевому слову"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Подробный вывод"
    )
    parser.add_argument(
        "--html",
        help="Путь для HTML отчёта"
    )
    parser.add_argument(
        "-n", "--parallel",
        type=int,
        help="Количество параллельных процессов"
    )
    parser.add_argument(
        "--file", "-f",
        help="Запустить тесты из конкретного файла"
    )
    parser.add_argument(
        "--collect-only",
        action="store_true",
        help="Только показать список тестов, не запускать"
    )
    
    args = parser.parse_args()
    
    # Формируем команду pytest через python -m pytest
    # Это гарантирует работу на Windows и в виртуальных окружениях
    cmd = [python_executable, "-m", "pytest"]
    
    # Путь к тестам
    tests_dir = Path(__file__).parent / "tests"
    
    if args.file:
        cmd.append(str(tests_dir / args.file))
    else:
        cmd.append(str(tests_dir))
    
    # Маркеры
    if args.smoke:
        cmd.extend(["-m", "smoke"])
    elif args.regression:
        cmd.extend(["-m", "regression"])
    
    # Браузер
    cmd.extend([f"--browser={args.browser}"])
    
    # Headless
    if args.headless:
        cmd.append("--headless")
    
    # URLs
    cmd.extend([f"--base-url={args.base_url}"])
    cmd.extend([f"--api-url={args.api_url}"])
    
    # Автозапуск
    if args.no_auto_setup:
        cmd.append("--no-auto-setup")
    if args.no_docker:
        cmd.append("--no-docker")
    if args.no_auto_users:
        cmd.append("--no-auto-users")
    if args.keep_containers:
        cmd.append("--keep-containers")
    if args.reuse_browser:
        cmd.append("--reuse-browser")
    
    # Фильтр
    if args.keyword:
        cmd.extend(["-k", args.keyword])
    
    # Verbose
    if args.verbose:
        cmd.append("-v")
    
    # HTML отчёт
    if args.html:
        cmd.extend(["--html", args.html, "--self-contained-html"])
    
    # Параллельный запуск
    if args.parallel:
        cmd.extend(["-n", str(args.parallel)])
    
    # Collect only
    if args.collect_only:
        cmd.append("--collect-only")
    
    # Вывод команды
    print("=" * 60)
    print("🚀 Запуск Selenium тестов")
    print("=" * 60)
    print(f"\nКоманда: {' '.join(cmd)}\n")
    
    # Запуск
    result = subprocess.run(cmd, cwd=Path(__file__).parent)
    
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
