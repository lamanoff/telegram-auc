"""
Вспомогательные функции для Selenium тестов.
"""
import time
from functools import wraps
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.common.exceptions import StaleElementReferenceException


def wait_for_ajax(driver: WebDriver, timeout: int = 30) -> bool:
    """
    Ожидание завершения всех AJAX запросов.
    
    Args:
        driver: WebDriver instance
        timeout: максимальное время ожидания в секундах
        
    Returns:
        True если все запросы завершены, False при таймауте
    """
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # Проверяем jQuery (если используется)
        try:
            jquery_active = driver.execute_script(
                "return typeof jQuery !== 'undefined' && jQuery.active === 0"
            )
            if jquery_active:
                return True
        except:
            pass
        
        # Проверяем XMLHttpRequest
        try:
            xhr_complete = driver.execute_script(
                """
                return document.readyState === 'complete' &&
                       (typeof window.XMLHttpRequest === 'undefined' ||
                        new window.XMLHttpRequest().readyState === 0 ||
                        new window.XMLHttpRequest().readyState === 4);
                """
            )
            if xhr_complete:
                return True
        except:
            pass
        
        time.sleep(0.5)
    
    return False


def scroll_into_view(driver: WebDriver, element: WebElement) -> None:
    """
    Прокрутка элемента в видимую область.
    
    Args:
        driver: WebDriver instance
        element: элемент для прокрутки
    """
    driver.execute_script(
        "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
        element
    )
    time.sleep(0.5)  # Даём время на плавную прокрутку


def retry_on_stale(max_retries: int = 3, delay: float = 0.5):
    """
    Декоратор для повторных попыток при StaleElementReferenceException.
    
    Args:
        max_retries: максимальное количество попыток
        delay: задержка между попытками в секундах
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except StaleElementReferenceException as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        time.sleep(delay)
            
            raise last_exception
        
        return wrapper
    return decorator


def highlight_element(driver: WebDriver, element: WebElement, duration: float = 0.5) -> None:
    """
    Подсветка элемента для визуальной отладки.
    
    Args:
        driver: WebDriver instance
        element: элемент для подсветки
        duration: длительность подсветки в секундах
    """
    original_style = element.get_attribute("style")
    
    driver.execute_script(
        "arguments[0].setAttribute('style', arguments[1]);",
        element,
        "border: 2px solid red !important; background: yellow !important;"
    )
    
    time.sleep(duration)
    
    driver.execute_script(
        "arguments[0].setAttribute('style', arguments[1]);",
        element,
        original_style or ""
    )


def take_element_screenshot(driver: WebDriver, element: WebElement, filename: str) -> None:
    """
    Скриншот конкретного элемента.
    
    Args:
        driver: WebDriver instance
        element: элемент для скриншота
        filename: путь к файлу для сохранения
    """
    scroll_into_view(driver, element)
    element.screenshot(filename)


def get_computed_style(driver: WebDriver, element: WebElement, property_name: str) -> str:
    """
    Получение вычисленного CSS стиля элемента.
    
    Args:
        driver: WebDriver instance
        element: элемент
        property_name: имя CSS свойства
        
    Returns:
        значение CSS свойства
    """
    return driver.execute_script(
        "return window.getComputedStyle(arguments[0]).getPropertyValue(arguments[1]);",
        element,
        property_name
    )


def is_element_in_viewport(driver: WebDriver, element: WebElement) -> bool:
    """
    Проверка, находится ли элемент в видимой области.
    
    Args:
        driver: WebDriver instance
        element: элемент для проверки
        
    Returns:
        True если элемент в видимой области
    """
    return driver.execute_script(
        """
        var elem = arguments[0];
        var rect = elem.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        """,
        element
    )


def clear_local_storage(driver: WebDriver) -> None:
    """
    Очистка localStorage.
    
    Args:
        driver: WebDriver instance
    """
    driver.execute_script("window.localStorage.clear();")


def clear_session_storage(driver: WebDriver) -> None:
    """
    Очистка sessionStorage.
    
    Args:
        driver: WebDriver instance
    """
    driver.execute_script("window.sessionStorage.clear();")


def get_local_storage_item(driver: WebDriver, key: str) -> str:
    """
    Получение элемента из localStorage.
    
    Args:
        driver: WebDriver instance
        key: ключ
        
    Returns:
        значение или None
    """
    return driver.execute_script(f"return window.localStorage.getItem('{key}');")


def set_local_storage_item(driver: WebDriver, key: str, value: str) -> None:
    """
    Установка элемента в localStorage.
    
    Args:
        driver: WebDriver instance
        key: ключ
        value: значение
    """
    driver.execute_script(f"window.localStorage.setItem('{key}', '{value}');")


def get_console_logs(driver: WebDriver) -> list:
    """
    Получение логов консоли браузера (только для Chrome).
    
    Args:
        driver: WebDriver instance
        
    Returns:
        список логов
    """
    try:
        return driver.get_log('browser')
    except:
        return []


def get_network_entries(driver: WebDriver) -> list:
    """
    Получение сетевых запросов через Performance API.
    
    Args:
        driver: WebDriver instance
        
    Returns:
        список сетевых запросов
    """
    try:
        return driver.execute_script(
            "return window.performance.getEntriesByType('resource');"
        )
    except:
        return []
