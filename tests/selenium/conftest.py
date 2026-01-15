"""
Конфигурация pytest и fixtures для Selenium тестов CryptoAuction Platform.
Автоматически проверяет и запускает необходимые сервисы.

Использует встроенный Selenium Manager (Selenium 4.6+) для управления драйверами.
"""
import os
import pytest
import logging
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from dotenv import load_dotenv
from faker import Faker

# Добавляем путь к utils
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.environment import EnvironmentManager, get_environment_manager

# Загрузка переменных окружения
load_dotenv()

# Отключаем лишние логи Selenium
logging.getLogger('selenium').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Инициализация Faker для русской локали
fake = Faker('ru_RU')

# Глобальный менеджер окружения
_env_manager = None
_environment_ready = False


def pytest_addoption(parser):
    """Добавление CLI опций для pytest."""
    parser.addoption(
        "--browser",
        action="store",
        default="chrome",
        help="Browser to run tests: chrome, firefox, edge"
    )
    parser.addoption(
        "--headless",
        action="store_true",
        default=False,
        help="Run browser in headless mode"
    )
    parser.addoption(
        "--base-url",
        action="store",
        default=os.getenv("BASE_URL", "http://localhost:8080"),  # Docker порт
        help="Base URL for the application"
    )
    parser.addoption(
        "--api-url",
        action="store",
        default=os.getenv("API_URL", "http://localhost:3000"),
        help="API URL for the application"
    )
    parser.addoption(
        "--slow-mo",
        action="store",
        type=int,
        default=0,
        help="Slow down browser actions by specified milliseconds"
    )
    parser.addoption(
        "--no-auto-setup",
        action="store_true",
        default=False,
        help="Disable automatic environment setup (docker-compose, users)"
    )
    parser.addoption(
        "--no-docker",
        action="store_true",
        default=False,
        help="Disable automatic docker-compose startup"
    )
    parser.addoption(
        "--no-auto-users",
        action="store_true",
        default=False,
        help="Disable automatic test user creation"
    )
    parser.addoption(
        "--keep-containers",
        action="store_true",
        default=False,
        help="Don't stop docker containers after tests"
    )
    parser.addoption(
        "--reuse-browser",
        action="store_true",
        default=False,
        help="Reuse same browser instance for all tests (faster but less isolated)"
    )


def pytest_configure(config):
    """
    Конфигурация pytest - запускается один раз в начале сессии.
    Здесь проверяем и запускаем docker-compose.
    """
    global _env_manager, _environment_ready
    
    # Пропускаем автоматическую настройку если указан флаг
    if config.getoption("--no-auto-setup"):
        print("\n⚠ Автоматическая настройка окружения отключена (--no-auto-setup)")
        _environment_ready = True
        return
    
    base_url = config.getoption("--base-url")
    api_url = config.getoption("--api-url")
    
    # Создаём менеджер окружения
    _env_manager = EnvironmentManager(base_url=base_url, api_url=api_url)
    
    # Если --keep-containers, не останавливаем контейнеры после тестов
    if config.getoption("--keep-containers"):
        _env_manager._compose_started_by_us = False
    
    # Определяем, что нужно запускать
    start_compose = not config.getoption("--no-docker")
    create_users = not config.getoption("--no-auto-users")
    
    # Подготавливаем окружение
    _environment_ready = _env_manager.setup(
        start_compose=start_compose,
        create_users=create_users
    )


def pytest_unconfigure(config):
    """
    Очистка после завершения всех тестов.
    """
    global _env_manager
    
    if _env_manager is not None:
        _env_manager.cleanup()


@pytest.fixture(scope="session")
def environment_ready():
    """Fixture для проверки готовности окружения."""
    return _environment_ready


@pytest.fixture(scope="session")
def base_url(request):
    """Базовый URL приложения."""
    return request.config.getoption("--base-url")


@pytest.fixture(scope="session")
def api_url(request):
    """URL API."""
    return request.config.getoption("--api-url")


# Глобальный браузер для режима --reuse-browser
_shared_driver = None


def _is_browser_alive(driver) -> bool:
    """Проверить, жив ли браузер."""
    if driver is None:
        return False
    try:
        # Устанавливаем короткий таймаут для проверки
        _ = driver.current_url
        return True
    except Exception:
        return False


@pytest.fixture(scope="function")
def driver(request, base_url):
    """
    Fixture для создания WebDriver.
    Использует встроенный Selenium Manager (Selenium 4.6+) - драйвер качается автоматически.
    С --reuse-browser использует один браузер для всех тестов.
    """
    global _shared_driver
    
    browser = request.config.getoption("--browser").lower()
    headless = request.config.getoption("--headless")
    reuse = request.config.getoption("--reuse-browser")
    
    if reuse:
        # Режим переиспользования браузера
        need_new_driver = _shared_driver is None or not _is_browser_alive(_shared_driver)
        
        if need_new_driver:
            # Закрываем старый если есть
            if _shared_driver is not None:
                try:
                    _shared_driver.quit()
                except Exception:
                    pass
            _shared_driver = _create_driver(browser, headless)
            _shared_driver.get(base_url)
        
        driver = _shared_driver
        
        # Очищаем состояние между тестами
        try:
            driver.delete_all_cookies()
            driver.execute_script("window.localStorage.clear();")
            driver.execute_script("window.sessionStorage.clear();")
            driver.get(base_url)
        except Exception:
            # Если браузер закрылся - создаём новый
            try:
                _shared_driver.quit()
            except Exception:
                pass
            _shared_driver = _create_driver(browser, headless)
            _shared_driver.get(base_url)
            driver = _shared_driver
        
        yield driver
        # Не закрываем браузер в этом режиме
    else:
        # Обычный режим - новый браузер на каждый тест
        driver = _create_driver(browser, headless)
        driver.get(base_url)
        yield driver
        try:
            driver.quit()
        except Exception:
            pass


def pytest_sessionfinish(session, exitstatus):
    """Закрыть shared driver в конце сессии."""
    global _shared_driver
    if _shared_driver is not None:
        try:
            if _is_browser_alive(_shared_driver):
                _shared_driver.quit()
        except Exception:
            pass
        finally:
            _shared_driver = None


def _create_driver(browser: str, headless: bool):
    """
    Создать экземпляр WebDriver.
    Selenium Manager автоматически скачивает нужный драйвер (Selenium 4.6+).
    """
    if browser == "chrome":
        options = ChromeOptions()
        if headless:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--disable-infobars")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-notifications")
        options.add_argument("--disable-save-password-bubble")
        
        # Отключаем проверку паролей и предупреждения безопасности
        prefs = {
            "credentials_enable_service": False,
            "profile.password_manager_enabled": False,
            "profile.password_manager_leak_detection": False,
            "safebrowsing.enabled": False,
            "autofill.profile_enabled": False,
        }
        options.add_experimental_option("prefs", prefs)
        options.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # Selenium Manager сам найдёт/скачает chromedriver
        driver = webdriver.Chrome(options=options)
        
    elif browser == "firefox":
        options = FirefoxOptions()
        if headless:
            options.add_argument("--headless")
        options.add_argument("--width=1920")
        options.add_argument("--height=1080")
        
        driver = webdriver.Firefox(options=options)
        
    elif browser == "edge":
        options = EdgeOptions()
        if headless:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        
        driver = webdriver.Edge(options=options)
        
    else:
        raise ValueError(f"Unsupported browser: {browser}")
    
    driver.implicitly_wait(10)
    driver.set_page_load_timeout(30)
    
    return driver


@pytest.fixture(scope="function")
def logged_in_driver(driver, base_url, test_user):
    """
    Fixture для WebDriver с выполненным входом в систему.
    """
    from pages.login_page import LoginPage
    
    login_page = LoginPage(driver, base_url)
    login_page.open()
    login_page.login(test_user["username"], test_user["password"])
    
    yield driver


@pytest.fixture(scope="session")
def test_user():
    """
    Данные тестового пользователя.
    """
    return {
        "username": os.getenv("TEST_USERNAME", "testuser"),
        "password": os.getenv("TEST_PASSWORD", "testpass123")
    }


@pytest.fixture(scope="session")
def admin_user():
    """
    Данные администратора.
    """
    return {
        "username": os.getenv("ADMIN_USERNAME", "admin"),
        "password": os.getenv("ADMIN_PASSWORD", "admin123")
    }


@pytest.fixture(scope="function")
def unique_user():
    """
    Генерация уникальных данных пользователя для каждого теста.
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return {
        "username": f"test_{timestamp}_{fake.pyint(min_value=1000, max_value=9999)}",
        "password": fake.password(length=12, special_chars=False)
    }


@pytest.fixture(scope="function")
def admin_logged_in_driver(driver, base_url, admin_user):
    """
    Fixture для WebDriver с выполненным входом под админом.
    """
    from pages.login_page import LoginPage
    
    login_page = LoginPage(driver, base_url)
    login_page.open()
    login_page.login(admin_user["username"], admin_user["password"])
    
    yield driver


# Hooks для отчётов
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    Создание скриншота при падении теста.
    """
    outcome = yield
    report = outcome.get_result()
    
    if report.when == "call" and report.failed:
        driver = item.funcargs.get("driver")
        if driver:
            try:
                # Проверяем жив ли браузер
                if not _is_browser_alive(driver):
                    print("\n⚠️ Браузер недоступен, скриншот не сохранён")
                    return
                    
                screenshot_dir = os.path.join(os.path.dirname(__file__), "screenshots")
                os.makedirs(screenshot_dir, exist_ok=True)

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                screenshot_path = os.path.join(
                    screenshot_dir,
                    f"{item.name}_{timestamp}.png"
                )
                driver.save_screenshot(screenshot_path)
                print(f"\n📸 Скриншот сохранён: {screenshot_path}")
            except Exception as e:
                print(f"\n⚠️ Не удалось сохранить скриншот: {e}")
