"""
Модуль автоматической подготовки окружения для тестов.
Запускает docker-compose и создаёт тестовых пользователей.
"""
import os
import sys
import time
import socket
import subprocess
import requests
import atexit
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse


class EnvironmentManager:
    """
    Менеджер окружения для Selenium тестов.
    Запускает docker-compose и создаёт тестовых пользователей.
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:8080",  # Фронтенд в docker на 8080
        api_url: str = "http://localhost:3000",
        project_root: Optional[str] = None
    ):
        self.base_url = base_url
        self.api_url = api_url
        self.project_root = project_root or self._find_project_root()
        
        # Флаг, что мы запустили docker-compose
        self._compose_started_by_us = False
        
        # Регистрируем cleanup при выходе
        atexit.register(self.cleanup)
    
    def _find_project_root(self) -> str:
        """Найти корневую папку проекта."""
        current = Path(__file__).resolve()
        
        # Ищем папку с docker-compose.yml
        for parent in current.parents:
            if (parent / "docker-compose.yml").exists():
                return str(parent)
        
        # Если не нашли, берём 3 уровня вверх от текущего файла
        return str(current.parents[3])
    
    def _parse_url(self, url: str) -> Tuple[str, int]:
        """Извлечь хост и порт из URL."""
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        return host, port
    
    def _is_port_open(self, host: str, port: int, timeout: float = 1.0) -> bool:
        """Проверить, открыт ли порт."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                result = sock.connect_ex((host, port))
                return result == 0
        except Exception:
            return False
    
    def _run_command(self, cmd: str, cwd: str = None, timeout: int = 300) -> Tuple[int, str, str]:
        """Выполнить команду и вернуть результат."""
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=cwd or self.project_root,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding='utf-8',
                errors='replace'
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", "Timeout"
        except Exception as e:
            return -1, "", str(e)
    
    def is_docker_available(self) -> bool:
        """Проверить, доступен ли Docker."""
        code, _, _ = self._run_command("docker info", timeout=10)
        return code == 0
    
    def is_compose_running(self) -> bool:
        """Проверить, запущен ли docker-compose."""
        code, stdout, _ = self._run_command("docker compose ps --format json", timeout=10)
        if code != 0:
            # Попробуем старый формат docker-compose
            code, stdout, _ = self._run_command("docker-compose ps", timeout=10)
        
        # Проверяем что контейнеры запущены
        return code == 0 and ("auction-backend" in stdout or "running" in stdout.lower())
    
    def is_backend_running(self) -> bool:
        """Проверить, запущен ли бэкенд."""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            pass
        
        # Пробуем просто проверить порт
        host, port = self._parse_url(self.api_url)
        return self._is_port_open(host, port)
    
    def is_frontend_running(self) -> bool:
        """Проверить, запущен ли фронтенд."""
        try:
            response = requests.get(self.base_url, timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            pass
        
        host, port = self._parse_url(self.base_url)
        return self._is_port_open(host, port)
    
    def start_compose(self) -> bool:
        """Запустить docker-compose."""
        # Проверяем Docker
        if not self.is_docker_available():
            print("✗ Docker не доступен. Убедитесь, что Docker Desktop запущен.")
            return False
        
        # Если уже запущен
        if self.is_compose_running() and self.is_backend_running():
            print("✓ Docker Compose уже запущен")
            return True
        
        print("⏳ Запуск Docker Compose...")
        print(f"   Папка: {self.project_root}")
        
        # Запускаем docker-compose
        # Сначала пробуем новый формат (docker compose), потом старый (docker-compose)
        code, stdout, stderr = self._run_command(
            "docker compose up -d --build",
            timeout=600  # 10 минут на билд
        )
        
        if code != 0:
            # Пробуем старый формат
            code, stdout, stderr = self._run_command(
                "docker-compose up -d --build",
                timeout=600
            )
        
        if code != 0:
            print(f"✗ Ошибка запуска docker-compose:")
            print(f"   {stderr}")
            return False
        
        print("   Контейнеры запускаются...")
        
        # Ждём готовности сервисов
        if not self._wait_for_services(timeout=180):
            print("✗ Сервисы не запустились вовремя")
            self._show_compose_logs()
            return False
        
        print("✓ Docker Compose запущен")
        self._compose_started_by_us = True
        return True
    
    def _wait_for_services(self, timeout: int = 180) -> bool:
        """Ожидание готовности всех сервисов."""
        start_time = time.time()
        backend_ready = False
        frontend_ready = False
        
        while time.time() - start_time < timeout:
            if not backend_ready and self.is_backend_running():
                print("   ✓ Бэкенд готов")
                backend_ready = True
            
            if not frontend_ready and self.is_frontend_running():
                print("   ✓ Фронтенд готов")
                frontend_ready = True
            
            if backend_ready and frontend_ready:
                return True
            
            # Показываем прогресс
            elapsed = int(time.time() - start_time)
            if elapsed % 10 == 0 and elapsed > 0:
                status = []
                if not backend_ready:
                    status.append("бэкенд")
                if not frontend_ready:
                    status.append("фронтенд")
                print(f"   ⏳ Ожидание: {', '.join(status)} ({elapsed}s)")
            
            time.sleep(2)
        
        return False
    
    def _show_compose_logs(self) -> None:
        """Показать логи docker-compose для диагностики."""
        print("\n   Логи контейнеров:")
        code, stdout, _ = self._run_command("docker compose logs --tail=20", timeout=30)
        if code != 0:
            code, stdout, _ = self._run_command("docker-compose logs --tail=20", timeout=30)
        
        if stdout:
            for line in stdout.split('\n')[-15:]:
                print(f"   {line}")
    
    def stop_compose(self) -> None:
        """Остановить docker-compose."""
        print("⏳ Остановка Docker Compose...")
        
        code, _, _ = self._run_command("docker compose down", timeout=60)
        if code != 0:
            self._run_command("docker-compose down", timeout=60)
        
        print("✓ Docker Compose остановлен")
    
    def create_user(self, username: str, password: str) -> bool:
        """Создать пользователя через API регистрации."""
        try:
            response = requests.post(
                f"{self.api_url}/api/register",
                json={"username": username, "password": password},
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                print(f"   ✓ Пользователь '{username}' создан")
                return True
            elif response.status_code == 409 or "already exists" in response.text.lower() or "уже существует" in response.text.lower():
                print(f"   ✓ Пользователь '{username}' уже существует")
                return True
            else:
                print(f"   ⚠ Не удалось создать '{username}': {response.text[:100]}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"   ✗ Ошибка при создании '{username}': {e}")
            return False
    
    def ensure_test_users(
        self,
        test_user: dict = None,
        admin_user: dict = None
    ) -> bool:
        """Убедиться, что тестовые пользователи созданы."""
        print("⏳ Создание тестовых пользователей...")
        
        if test_user is None:
            test_user = {
                "username": os.getenv("TEST_USERNAME", "testuser"),
                "password": os.getenv("TEST_PASSWORD", "testpass123")
            }
        
        if admin_user is None:
            admin_user = {
                "username": os.getenv("ADMIN_USERNAME", "admin"),
                "password": os.getenv("ADMIN_PASSWORD", "admin123")
            }
        
        success = True
        
        # Создаём обычного пользователя
        if not self.create_user(test_user["username"], test_user["password"]):
            success = False
        
        # Создаём админа
        if not self.create_user(admin_user["username"], admin_user["password"]):
            success = False
        
        return success
    
    def setup(
        self,
        start_compose: bool = True,
        create_users: bool = True,
        test_user: dict = None,
        admin_user: dict = None
    ) -> bool:
        """
        Полная подготовка окружения.
        
        Args:
            start_compose: Запустить docker-compose если не запущен
            create_users: Создать тестовых пользователей
            test_user: Данные тестового пользователя
            admin_user: Данные администратора
            
        Returns:
            True если всё успешно подготовлено
        """
        print("\n" + "="*50)
        print("🔧 Подготовка тестового окружения")
        print("="*50 + "\n")
        
        success = True
        
        # Запускаем docker-compose
        if start_compose:
            if not self.start_compose():
                print("\n⚠ Docker Compose не запустился")
                print("   Попробуйте запустить вручную: docker compose up -d")
                success = False
        
        # Создаём пользователей (только если бэкенд работает)
        if create_users and self.is_backend_running():
            # Даём бэкенду время инициализироваться
            time.sleep(2)
            if not self.ensure_test_users(test_user, admin_user):
                print("⚠ Некоторые пользователи не были созданы")
        
        print("\n" + "="*50)
        if success:
            print("✅ Окружение готово к тестированию")
            print(f"   Фронтенд: {self.base_url}")
            print(f"   API: {self.api_url}")
        else:
            print("⚠ Окружение подготовлено с предупреждениями")
        print("="*50 + "\n")
        
        return success
    
    def cleanup(self):
        """Остановить запущенные нами сервисы."""
        if self._compose_started_by_us:
            self.stop_compose()


# Глобальный экземпляр
_environment_manager: Optional[EnvironmentManager] = None


def get_environment_manager(
    base_url: str = None,
    api_url: str = None
) -> EnvironmentManager:
    """Получить или создать глобальный экземпляр EnvironmentManager."""
    global _environment_manager
    
    if _environment_manager is None:
        _environment_manager = EnvironmentManager(
            base_url=base_url or os.getenv("BASE_URL", "http://localhost:8080"),
            api_url=api_url or os.getenv("API_URL", "http://localhost:3000")
        )
    
    return _environment_manager


def setup_environment(
    base_url: str = None,
    api_url: str = None,
    start_compose: bool = True,
    create_users: bool = True
) -> bool:
    """
    Удобная функция для подготовки окружения.
    Вызывается автоматически в conftest.py.
    """
    manager = get_environment_manager(base_url, api_url)
    return manager.setup(
        start_compose=start_compose,
        create_users=create_users
    )


if __name__ == "__main__":
    # Тест модуля
    print("Тестирование EnvironmentManager\n")
    
    manager = EnvironmentManager()
    
    print(f"Docker доступен: {manager.is_docker_available()}")
    print(f"Compose запущен: {manager.is_compose_running()}")
    print(f"Backend работает: {manager.is_backend_running()}")
    print(f"Frontend работает: {manager.is_frontend_running()}")
    
    if input("\nЗапустить окружение? (y/n): ").lower() == 'y':
        manager.setup()
        
        print("\nНажмите Enter для остановки...")
        input()
        
        manager.cleanup()
