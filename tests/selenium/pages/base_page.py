"""
Базовый класс Page Object с общими методами для всех страниц.
"""
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from typing import List, Optional


class BasePage:
    """
    Базовый класс для всех Page Object.
    Содержит общие методы взаимодействия с элементами.
    """
    
    # Локаторы навигации (общие для всех страниц)
    LOGO = (By.CSS_SELECTOR, ".logo")
    NAV_AUCTIONS = (By.CSS_SELECTOR, "a.nav-link[href='/auctions']")
    NAV_PROFILE = (By.CSS_SELECTOR, "a.nav-link[href='/profile']")
    NAV_ADMIN = (By.CSS_SELECTOR, "a.nav-link[href='/admin']")
    NAV_LOGIN = (By.CSS_SELECTOR, "a.nav-link[href='/login']")
    NAV_REGISTER = (By.CSS_SELECTOR, "a.btn[href='/register']")
    LOGOUT_BUTTON = (By.CSS_SELECTOR, ".btn-logout")
    BALANCE_DISPLAY = (By.CSS_SELECTOR, ".balance-value")
    
    # Общие элементы
    SPINNER = (By.CSS_SELECTOR, ".spinner")
    ALERT_ERROR = (By.CSS_SELECTOR, ".alert-error")
    ALERT_SUCCESS = (By.CSS_SELECTOR, ".alert-success")
    
    def __init__(self, driver: WebDriver, base_url: str):
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, 10)
        self.actions = ActionChains(driver)
    
    def open(self, path: str = "") -> "BasePage":
        """Открыть страницу по заданному пути."""
        url = f"{self.base_url}{path}"
        self.driver.get(url)
        return self
    
    def get_current_url(self) -> str:
        """Получить текущий URL."""
        return self.driver.current_url
    
    def get_title(self) -> str:
        """Получить title страницы."""
        return self.driver.title
    
    # Методы ожидания
    def wait_for_element(self, locator: tuple, timeout: int = 10) -> WebElement:
        """Ожидание появления элемента."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.presence_of_element_located(locator))
    
    def wait_for_element_visible(self, locator: tuple, timeout: int = 10) -> WebElement:
        """Ожидание видимости элемента."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.visibility_of_element_located(locator))
    
    def wait_for_element_clickable(self, locator: tuple, timeout: int = 10) -> WebElement:
        """Ожидание кликабельности элемента."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.element_to_be_clickable(locator))
    
    def wait_for_elements(self, locator: tuple, timeout: int = 10) -> List[WebElement]:
        """Ожидание появления нескольких элементов."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.presence_of_all_elements_located(locator))
    
    def wait_for_element_invisible(self, locator: tuple, timeout: int = 10) -> bool:
        """Ожидание исчезновения элемента."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.invisibility_of_element_located(locator))
    
    def wait_for_url_contains(self, text: str, timeout: int = 10) -> bool:
        """Ожидание изменения URL."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.url_contains(text))
    
    def wait_for_text_in_element(self, locator: tuple, text: str, timeout: int = 10) -> bool:
        """Ожидание текста в элементе."""
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.text_to_be_present_in_element(locator, text))
    
    def wait_for_spinner_disappear(self, timeout: int = 30) -> bool:
        """Ожидание исчезновения спиннера загрузки."""
        try:
            return self.wait_for_element_invisible(self.SPINNER, timeout)
        except TimeoutException:
            return True
    
    # Методы взаимодействия
    def find_element(self, locator: tuple) -> WebElement:
        """Найти элемент по локатору."""
        return self.driver.find_element(*locator)
    
    def find_elements(self, locator: tuple) -> List[WebElement]:
        """Найти элементы по локатору."""
        return self.driver.find_elements(*locator)
    
    def click(self, locator: tuple) -> None:
        """Клик по элементу."""
        element = self.wait_for_element_clickable(locator)
        element.click()
    
    def type_text(self, locator: tuple, text: str, clear_first: bool = True) -> None:
        """Ввод текста в поле."""
        element = self.wait_for_element_visible(locator)
        if clear_first:
            element.clear()
        element.send_keys(text)
    
    def set_datetime_input(self, locator: tuple, datetime_value: str) -> None:
        """
        Установить значение datetime-local input через JavaScript.
        datetime_value должен быть в формате YYYY-MM-DDTHH:MM (например 2026-01-15T10:30)
        """
        element = self.wait_for_element_visible(locator)
        # Используем JavaScript для установки значения, т.к. send_keys плохо работает с datetime-local
        self.driver.execute_script("arguments[0].value = arguments[1];", element, datetime_value)
        # Триггерим событие input чтобы Vue поймал изменение
        self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", element)
        self.driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", element)
    
    def get_text(self, locator: tuple) -> str:
        """Получить текст элемента."""
        element = self.wait_for_element_visible(locator)
        return element.text
    
    def get_attribute(self, locator: tuple, attribute: str) -> Optional[str]:
        """Получить атрибут элемента."""
        element = self.wait_for_element(locator)
        return element.get_attribute(attribute)
    
    def is_element_present(self, locator: tuple) -> bool:
        """Проверка наличия элемента."""
        try:
            self.driver.find_element(*locator)
            return True
        except NoSuchElementException:
            return False
    
    def is_element_visible(self, locator: tuple, timeout: int = 3) -> bool:
        """Проверка видимости элемента."""
        try:
            wait = WebDriverWait(self.driver, timeout)
            wait.until(EC.visibility_of_element_located(locator))
            return True
        except TimeoutException:
            return False
    
    def scroll_to_element(self, locator: tuple) -> None:
        """Прокрутка к элементу."""
        element = self.find_element(locator)
        self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
    
    def scroll_to_bottom(self) -> None:
        """Прокрутка в конец страницы."""
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    
    def scroll_to_top(self) -> None:
        """Прокрутка в начало страницы."""
        self.driver.execute_script("window.scrollTo(0, 0);")
    
    def select_dropdown_option(self, locator: tuple, value: str) -> None:
        """Выбор опции в dropdown по значению."""
        from selenium.webdriver.support.ui import Select
        element = self.wait_for_element_visible(locator)
        select = Select(element)
        select.select_by_value(value)
    
    def get_selected_dropdown_value(self, locator: tuple) -> str:
        """Получить выбранное значение dropdown."""
        from selenium.webdriver.support.ui import Select
        element = self.wait_for_element(locator)
        select = Select(element)
        return select.first_selected_option.get_attribute("value")
    
    def hover(self, locator: tuple) -> None:
        """Наведение на элемент."""
        element = self.wait_for_element_visible(locator)
        self.actions.move_to_element(element).perform()
    
    def double_click(self, locator: tuple) -> None:
        """Двойной клик."""
        element = self.wait_for_element_clickable(locator)
        self.actions.double_click(element).perform()
    
    def right_click(self, locator: tuple) -> None:
        """Правый клик."""
        element = self.wait_for_element_visible(locator)
        self.actions.context_click(element).perform()
    
    def press_key(self, key: str) -> None:
        """Нажать клавишу."""
        self.actions.send_keys(key).perform()
    
    def press_enter(self, locator: tuple) -> None:
        """Нажать Enter в элементе."""
        element = self.wait_for_element(locator)
        element.send_keys(Keys.ENTER)
    
    def refresh(self) -> None:
        """Обновить страницу."""
        self.driver.refresh()
    
    def go_back(self) -> None:
        """Вернуться назад."""
        self.driver.back()
    
    def go_forward(self) -> None:
        """Перейти вперёд."""
        self.driver.forward()
    
    def switch_to_alert(self):
        """Переключиться на alert."""
        return self.driver.switch_to.alert
    
    def accept_alert(self) -> None:
        """Принять alert."""
        alert = self.wait.until(EC.alert_is_present())
        alert.accept()
    
    def dismiss_alert(self) -> None:
        """Отклонить alert."""
        alert = self.wait.until(EC.alert_is_present())
        alert.dismiss()
    
    def get_alert_text(self) -> str:
        """Получить текст alert."""
        alert = self.wait.until(EC.alert_is_present())
        return alert.text
    
    def take_screenshot(self, filename: str) -> None:
        """Сделать скриншот."""
        self.driver.save_screenshot(filename)
    
    def execute_script(self, script: str, *args):
        """Выполнить JavaScript."""
        return self.driver.execute_script(script, *args)
    
    # Методы навигации
    def click_logo(self) -> None:
        """Клик по логотипу (переход на главную)."""
        self.click(self.LOGO)
    
    def navigate_to_auctions(self) -> None:
        """Переход на страницу аукционов."""
        self.click(self.NAV_AUCTIONS)
    
    def navigate_to_profile(self) -> None:
        """Переход на страницу профиля."""
        self.click(self.NAV_PROFILE)
    
    def navigate_to_admin(self) -> None:
        """Переход в админ панель."""
        self.click(self.NAV_ADMIN)
    
    def navigate_to_login(self) -> None:
        """Переход на страницу входа."""
        self.click(self.NAV_LOGIN)
    
    def navigate_to_register(self) -> None:
        """Переход на страницу регистрации."""
        self.click(self.NAV_REGISTER)
    
    def logout(self) -> None:
        """Выход из аккаунта."""
        self.click(self.LOGOUT_BUTTON)
    
    def is_logged_in(self) -> bool:
        """Проверка авторизации пользователя."""
        return self.is_element_visible(self.LOGOUT_BUTTON)
    
    def is_admin_link_visible(self) -> bool:
        """Проверка видимости ссылки на админку."""
        return self.is_element_visible(self.NAV_ADMIN)
    
    def get_balance(self) -> str:
        """Получить отображаемый баланс."""
        return self.get_text(self.BALANCE_DISPLAY)
    
    def get_error_message(self) -> str:
        """Получить текст ошибки."""
        return self.get_text(self.ALERT_ERROR)
    
    def get_success_message(self) -> str:
        """Получить текст успешного сообщения."""
        return self.get_text(self.ALERT_SUCCESS)
    
    def is_error_displayed(self) -> bool:
        """Проверка отображения ошибки."""
        return self.is_element_visible(self.ALERT_ERROR)
    
    def is_success_displayed(self) -> bool:
        """Проверка отображения успешного сообщения."""
        return self.is_element_visible(self.ALERT_SUCCESS)
