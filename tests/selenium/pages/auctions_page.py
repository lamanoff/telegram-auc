"""
Page Object для страницы списка аукционов.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from typing import List, Optional


class AuctionsPage(BasePage):
    """
    Page Object для страницы списка аукционов (Auctions).
    """
    
    # Локаторы
    PAGE_TITLE = (By.CSS_SELECTOR, ".page-header h1")
    PAGE_DESCRIPTION = (By.CSS_SELECTOR, ".page-description")
    CREATE_AUCTION_BTN = (By.CSS_SELECTOR, ".page-header .btn-primary")
    
    # Состояния
    LOADING_STATE = (By.CSS_SELECTOR, ".loading-state")
    EMPTY_STATE = (By.CSS_SELECTOR, ".empty-state")
    EMPTY_ICON = (By.CSS_SELECTOR, ".empty-icon")
    
    # Сетка аукционов
    AUCTIONS_GRID = (By.CSS_SELECTOR, ".auctions-grid")
    AUCTION_CARDS = (By.CSS_SELECTOR, ".auction-card")
    
    # Элементы карточки аукциона
    CARD_STATUS_BADGE = (By.CSS_SELECTOR, ".badge")
    CARD_CURRENCY_BADGE = (By.CSS_SELECTOR, ".currency-badge")
    CARD_TITLE = (By.CSS_SELECTOR, ".auction-title")
    CARD_DESCRIPTION = (By.CSS_SELECTOR, ".auction-description")
    CARD_ROUND_INFO = (By.CSS_SELECTOR, ".stat-value")
    CARD_DETAIL_BUTTON = (By.CSS_SELECTOR, ".btn-primary")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/auctions"
    
    def open(self) -> "AuctionsPage":
        """Открыть страницу аукционов."""
        super().open(self.path)
        self.wait_for_spinner_disappear()
        return self
    
    def get_page_title(self) -> str:
        """Получить заголовок страницы."""
        return self.get_text(self.PAGE_TITLE)
    
    def get_page_description(self) -> str:
        """Получить описание страницы."""
        return self.get_text(self.PAGE_DESCRIPTION)
    
    def is_loading(self) -> bool:
        """Проверить, загружается ли страница."""
        return self.is_element_visible(self.LOADING_STATE, timeout=1)
    
    def is_empty(self) -> bool:
        """Проверить, пустой ли список аукционов."""
        return self.is_element_visible(self.EMPTY_STATE, timeout=2)
    
    def is_create_button_visible(self) -> bool:
        """Проверить видимость кнопки создания (для админов)."""
        return self.is_element_visible(self.CREATE_AUCTION_BTN, timeout=2)
    
    def click_create_auction(self) -> None:
        """Клик по кнопке создания аукциона."""
        self.click(self.CREATE_AUCTION_BTN)
    
    def get_auctions_count(self) -> int:
        """Получить количество аукционов на странице."""
        try:
            cards = self.find_elements(self.AUCTION_CARDS)
            return len(cards)
        except:
            return 0
    
    def get_auction_cards(self) -> List[dict]:
        """
        Получить информацию о всех карточках аукционов.
        """
        cards = self.find_elements(self.AUCTION_CARDS)
        auctions = []
        
        for card in cards:
            try:
                auction = {
                    "title": card.find_element(By.CSS_SELECTOR, ".auction-title").text,
                    "description": card.find_element(By.CSS_SELECTOR, ".auction-description").text,
                    "status": card.find_element(By.CSS_SELECTOR, ".badge").text,
                    "currency": card.find_element(By.CSS_SELECTOR, ".currency-badge").text,
                }
                
                # Получаем статистику раундов и лотов
                stats = card.find_elements(By.CSS_SELECTOR, ".stat-value")
                if len(stats) >= 2:
                    auction["round"] = stats[0].text
                    auction["items"] = stats[1].text
                
                auctions.append(auction)
            except Exception as e:
                continue
        
        return auctions
    
    def get_auction_by_title(self, title: str) -> Optional[dict]:
        """Найти аукцион по названию."""
        auctions = self.get_auction_cards()
        for auction in auctions:
            if title.lower() in auction["title"].lower():
                return auction
        return None
    
    def click_auction_by_title(self, title: str) -> bool:
        """Клик по кнопке 'Подробнее' для аукциона с указанным названием."""
        cards = self.find_elements(self.AUCTION_CARDS)
        
        for card in cards:
            try:
                card_title = card.find_element(By.CSS_SELECTOR, ".auction-title").text
                if title.lower() in card_title.lower():
                    detail_btn = card.find_element(By.CSS_SELECTOR, ".btn-primary")
                    detail_btn.click()
                    return True
            except:
                continue
        
        return False
    
    def click_first_auction(self) -> bool:
        """Клик по первому аукциону в списке."""
        try:
            cards = self.find_elements(self.AUCTION_CARDS)
            if cards:
                detail_btn = cards[0].find_element(By.CSS_SELECTOR, ".btn-primary")
                detail_btn.click()
                return True
        except:
            pass
        return False
    
    def click_first_active_auction(self) -> bool:
        """Клик по первому активному аукциону."""
        cards = self.find_elements(self.AUCTION_CARDS)
        
        for card in cards:
            try:
                status = card.find_element(By.CSS_SELECTOR, ".badge").text
                if "Активен" in status:
                    detail_btn = card.find_element(By.CSS_SELECTOR, ".btn-primary")
                    detail_btn.click()
                    return True
            except:
                continue
        
        return False
    
    def get_active_auctions_count(self) -> int:
        """Получить количество активных аукционов."""
        count = 0
        cards = self.find_elements(self.AUCTION_CARDS)
        
        for card in cards:
            try:
                status = card.find_element(By.CSS_SELECTOR, ".badge").text
                if "Активен" in status:
                    count += 1
            except:
                continue
        
        return count
    
    def get_scheduled_auctions_count(self) -> int:
        """Получить количество запланированных аукционов."""
        count = 0
        cards = self.find_elements(self.AUCTION_CARDS)
        
        for card in cards:
            try:
                status = card.find_element(By.CSS_SELECTOR, ".badge").text
                if "Запланирован" in status:
                    count += 1
            except:
                continue
        
        return count
    
    def wait_for_auctions_loaded(self, timeout: int = 10) -> bool:
        """Ожидание загрузки аукционов."""
        try:
            self.wait_for_element_invisible(self.LOADING_STATE, timeout)
            return True
        except:
            return False
    
    def refresh_auctions(self) -> None:
        """Обновить список аукционов."""
        self.refresh()
        self.wait_for_spinner_disappear()
