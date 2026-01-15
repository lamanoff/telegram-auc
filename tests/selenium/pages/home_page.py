"""
Page Object для главной страницы.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class HomePage(BasePage):
    """
    Page Object для главной страницы (Home).
    """
    
    # Локаторы
    HERO_TITLE = (By.CSS_SELECTOR, ".hero-title")
    HERO_BADGE = (By.CSS_SELECTOR, ".hero-badge")
    HERO_DESCRIPTION = (By.CSS_SELECTOR, ".hero-description")
    
    # Кнопки Hero секции
    BTN_START_TRADING = (By.CSS_SELECTOR, ".hero-actions .btn-primary")
    BTN_LOGIN = (By.CSS_SELECTOR, ".hero-actions .btn-secondary")
    BTN_GO_TO_AUCTIONS = (By.CSS_SELECTOR, ".hero-actions a[href='/auctions']")
    
    # Features секция
    FEATURE_CARDS = (By.CSS_SELECTOR, ".feature-card")
    
    # Stats секция
    STATS_SECTION = (By.CSS_SELECTOR, ".stats-section")
    STAT_ITEMS = (By.CSS_SELECTOR, ".stat-item")
    STAT_NUMBERS = (By.CSS_SELECTOR, ".stat-number")
    
    # Floating cards
    FLOATING_CARDS = (By.CSS_SELECTOR, ".floating-card")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/"
    
    def open(self) -> "HomePage":
        """Открыть главную страницу."""
        super().open(self.path)
        return self
    
    def get_hero_title(self) -> str:
        """Получить заголовок hero секции."""
        return self.get_text(self.HERO_TITLE)
    
    def get_hero_description(self) -> str:
        """Получить описание hero секции."""
        return self.get_text(self.HERO_DESCRIPTION)
    
    def is_hero_badge_visible(self) -> bool:
        """Проверка видимости badge в hero."""
        return self.is_element_visible(self.HERO_BADGE)
    
    def click_start_trading(self) -> None:
        """Клик по кнопке 'Начать торговать'."""
        self.click(self.BTN_START_TRADING)
    
    def click_login_button(self) -> None:
        """Клик по кнопке 'Войти в аккаунт'."""
        self.click(self.BTN_LOGIN)
    
    def click_go_to_auctions(self) -> None:
        """Клик по кнопке 'Перейти к аукционам' (для авторизованных)."""
        self.click(self.BTN_GO_TO_AUCTIONS)
    
    def get_feature_cards_count(self) -> int:
        """Получить количество feature карточек."""
        cards = self.find_elements(self.FEATURE_CARDS)
        return len(cards)
    
    def get_feature_cards_titles(self) -> list:
        """Получить заголовки всех feature карточек."""
        cards = self.find_elements(self.FEATURE_CARDS)
        return [card.find_element(By.TAG_NAME, "h3").text for card in cards]
    
    def is_stats_section_visible(self) -> bool:
        """Проверка видимости секции статистики."""
        return self.is_element_visible(self.STATS_SECTION)
    
    def get_stats_count(self) -> int:
        """Получить количество stat элементов."""
        stats = self.find_elements(self.STAT_ITEMS)
        return len(stats)
    
    def get_stats_values(self) -> list:
        """Получить значения статистики."""
        numbers = self.find_elements(self.STAT_NUMBERS)
        return [num.text for num in numbers]
    
    def get_floating_cards_count(self) -> int:
        """Получить количество плавающих карточек."""
        cards = self.find_elements(self.FLOATING_CARDS)
        return len(cards)
    
    def is_login_buttons_visible(self) -> bool:
        """Проверка видимости кнопок входа/регистрации (для неавторизованных)."""
        return self.is_element_visible(self.BTN_START_TRADING) and self.is_element_visible(self.BTN_LOGIN)
    
    def is_go_to_auctions_visible(self) -> bool:
        """Проверка видимости кнопки 'Перейти к аукционам' (для авторизованных)."""
        return self.is_element_visible(self.BTN_GO_TO_AUCTIONS)
