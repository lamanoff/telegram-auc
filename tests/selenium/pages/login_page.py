"""
Page Object для страницы входа.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class LoginPage(BasePage):
    """
    Page Object для страницы входа (Login).
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
    
    # Сообщения
    ERROR_MESSAGE = (By.CSS_SELECTOR, ".alert-error")
    
    # Telegram
    TELEGRAM_SECTION = (By.CSS_SELECTOR, ".telegram-login-section")
    TELEGRAM_DIVIDER = (By.CSS_SELECTOR, ".divider")
    
    # Footer
    REGISTER_LINK = (By.CSS_SELECTOR, ".auth-footer a[href='/register']")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/login"
    
    def open(self) -> "LoginPage":
        """Открыть страницу входа."""
        super().open(self.path)
        return self
    
    def get_page_title(self) -> str:
        """Получить заголовок страницы."""
        return self.get_text(self.AUTH_TITLE)
    
    def get_page_description(self) -> str:
        """Получить описание страницы."""
        return self.get_text(self.AUTH_DESCRIPTION)
    
    def enter_username(self, username: str) -> "LoginPage":
        """Ввести имя пользователя."""
        self.type_text(self.USERNAME_INPUT, username)
        return self
    
    def enter_password(self, password: str) -> "LoginPage":
        """Ввести пароль."""
        self.type_text(self.PASSWORD_INPUT, password)
        return self
    
    def toggle_password_visibility(self) -> "LoginPage":
        """Переключить видимость пароля."""
        self.click(self.TOGGLE_PASSWORD_BTN)
        return self
    
    def is_password_visible(self) -> bool:
        """Проверить, виден ли пароль."""
        password_input = self.find_element(self.PASSWORD_INPUT)
        return password_input.get_attribute("type") == "text"
    
    def click_submit(self) -> None:
        """Нажать кнопку входа."""
        self.click(self.SUBMIT_BUTTON)
    
    def get_submit_button_text(self) -> str:
        """Получить текст кнопки отправки."""
        return self.get_text(self.SUBMIT_BUTTON)
    
    def is_submit_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка."""
        button = self.find_element(self.SUBMIT_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def login(self, username: str, password: str) -> None:
        """
        Выполнить полный процесс входа.
        """
        self.enter_username(username)
        self.enter_password(password)
        self.click_submit()
        # Ожидаем перехода на страницу аукционов или появления ошибки
        try:
            self.wait_for_url_contains("/auctions", timeout=5)
        except:
            pass  # Если не перешли, возможно ошибка входа
    
    def get_error_message(self) -> str:
        """Получить текст ошибки."""
        return self.get_text(self.ERROR_MESSAGE)
    
    def is_error_displayed(self) -> bool:
        """Проверить, отображается ли ошибка."""
        return self.is_element_visible(self.ERROR_MESSAGE)
    
    def click_register_link(self) -> None:
        """Клик по ссылке регистрации."""
        self.click(self.REGISTER_LINK)
    
    def is_telegram_section_visible(self) -> bool:
        """Проверить, отображается ли секция Telegram."""
        return self.is_element_visible(self.TELEGRAM_SECTION)
    
    def is_auth_card_visible(self) -> bool:
        """Проверить, отображается ли карточка авторизации."""
        return self.is_element_visible(self.AUTH_CARD)
    
    def clear_form(self) -> "LoginPage":
        """Очистить форму."""
        username_input = self.find_element(self.USERNAME_INPUT)
        password_input = self.find_element(self.PASSWORD_INPUT)
        username_input.clear()
        password_input.clear()
        return self
