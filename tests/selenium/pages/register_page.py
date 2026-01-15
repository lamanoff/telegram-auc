"""
Page Object для страницы регистрации.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class RegisterPage(BasePage):
    """
    Page Object для страницы регистрации (Register).
    """
    
    # Локаторы
    AUTH_CARD = (By.CSS_SELECTOR, ".auth-card")
    AUTH_ICON = (By.CSS_SELECTOR, ".auth-icon")
    AUTH_TITLE = (By.CSS_SELECTOR, ".auth-header h2")
    AUTH_DESCRIPTION = (By.CSS_SELECTOR, ".auth-header p")
    
    # Форма
    USERNAME_INPUT = (By.CSS_SELECTOR, "input[type='text']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[type='password'], input[placeholder*='пароль']")
    TOGGLE_PASSWORD_BTN = (By.CSS_SELECTOR, ".toggle-password")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    
    # Подсказки
    USERNAME_HINT = (By.CSS_SELECTOR, ".form-group:first-of-type small")
    PASSWORD_HINT = (By.CSS_SELECTOR, ".form-group:last-of-type small")
    
    # Сообщения
    ERROR_MESSAGE = (By.CSS_SELECTOR, ".alert-error")
    SUCCESS_MESSAGE = (By.CSS_SELECTOR, ".alert-success")
    
    # Telegram
    TELEGRAM_SECTION = (By.CSS_SELECTOR, ".telegram-login-section")
    
    # Footer
    LOGIN_LINK = (By.CSS_SELECTOR, ".auth-footer a[href='/login']")
    TERMS_TEXT = (By.CSS_SELECTOR, ".auth-terms")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/register"
    
    def open(self) -> "RegisterPage":
        """Открыть страницу регистрации."""
        super().open(self.path)
        return self
    
    def get_page_title(self) -> str:
        """Получить заголовок страницы."""
        return self.get_text(self.AUTH_TITLE)
    
    def get_page_description(self) -> str:
        """Получить описание страницы."""
        return self.get_text(self.AUTH_DESCRIPTION)
    
    def enter_username(self, username: str) -> "RegisterPage":
        """Ввести имя пользователя."""
        self.type_text(self.USERNAME_INPUT, username)
        return self
    
    def enter_password(self, password: str) -> "RegisterPage":
        """Ввести пароль."""
        self.type_text(self.PASSWORD_INPUT, password)
        return self
    
    def toggle_password_visibility(self) -> "RegisterPage":
        """Переключить видимость пароля."""
        self.click(self.TOGGLE_PASSWORD_BTN)
        return self
    
    def is_password_visible(self) -> bool:
        """Проверить, виден ли пароль."""
        password_input = self.find_element(self.PASSWORD_INPUT)
        return password_input.get_attribute("type") == "text"
    
    def click_submit(self) -> None:
        """Нажать кнопку регистрации."""
        self.click(self.SUBMIT_BUTTON)
    
    def get_submit_button_text(self) -> str:
        """Получить текст кнопки отправки."""
        return self.get_text(self.SUBMIT_BUTTON)
    
    def is_submit_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка."""
        button = self.find_element(self.SUBMIT_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def register(self, username: str, password: str) -> None:
        """
        Выполнить полный процесс регистрации.
        """
        self.enter_username(username)
        self.enter_password(password)
        self.click_submit()
    
    def register_and_wait_success(self, username: str, password: str) -> bool:
        """
        Выполнить регистрацию и дождаться успеха.
        """
        self.register(username, password)
        try:
            self.wait_for_element_visible(self.SUCCESS_MESSAGE, timeout=5)
            return True
        except:
            return False
    
    def get_error_message(self) -> str:
        """Получить текст ошибки."""
        return self.get_text(self.ERROR_MESSAGE)
    
    def is_error_displayed(self) -> bool:
        """Проверить, отображается ли ошибка."""
        return self.is_element_visible(self.ERROR_MESSAGE)
    
    def get_success_message(self) -> str:
        """Получить текст успешного сообщения."""
        return self.get_text(self.SUCCESS_MESSAGE)
    
    def is_success_displayed(self) -> bool:
        """Проверить, отображается ли успешное сообщение."""
        return self.is_element_visible(self.SUCCESS_MESSAGE)
    
    def click_login_link(self) -> None:
        """Клик по ссылке входа."""
        self.click(self.LOGIN_LINK)
    
    def get_username_hint(self) -> str:
        """Получить подсказку для поля username."""
        return self.get_text(self.USERNAME_HINT)
    
    def get_password_hint(self) -> str:
        """Получить подсказку для поля password."""
        return self.get_text(self.PASSWORD_HINT)
    
    def is_telegram_section_visible(self) -> bool:
        """Проверить, отображается ли секция Telegram."""
        return self.is_element_visible(self.TELEGRAM_SECTION)
    
    def get_terms_text(self) -> str:
        """Получить текст условий использования."""
        return self.get_text(self.TERMS_TEXT)
    
    def is_auth_card_visible(self) -> bool:
        """Проверить, отображается ли карточка регистрации."""
        return self.is_element_visible(self.AUTH_CARD)
    
    def clear_form(self) -> "RegisterPage":
        """Очистить форму."""
        username_input = self.find_element(self.USERNAME_INPUT)
        password_input = self.find_element(self.PASSWORD_INPUT)
        username_input.clear()
        password_input.clear()
        return self
