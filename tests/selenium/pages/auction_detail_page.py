"""
Page Object для страницы детального просмотра аукциона.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from typing import List, Optional


class AuctionDetailPage(BasePage):
    """
    Page Object для страницы детального просмотра аукциона (AuctionDetail).
    """
    
    # Локаторы состояний
    LOADING_STATE = (By.CSS_SELECTOR, ".loading-state")
    ERROR_STATE = (By.CSS_SELECTOR, ".alert-error")
    
    # Header
    AUCTION_HEADER = (By.CSS_SELECTOR, ".auction-header")
    STATUS_BADGE = (By.CSS_SELECTOR, ".header-badges .badge")
    CURRENCY_BADGE = (By.CSS_SELECTOR, ".currency-badge")
    AUCTION_TITLE = (By.CSS_SELECTOR, ".header-info h1")
    AUCTION_DESCRIPTION = (By.CSS_SELECTOR, ".description")
    
    # Минимальная ставка (для активных)
    MIN_BID_SECTION = (By.CSS_SELECTOR, ".header-price")
    MIN_BID_VALUE = (By.CSS_SELECTOR, ".price-value")
    
    # Stats Grid
    STATS_GRID = (By.CSS_SELECTOR, ".stats-grid")
    STAT_CARDS = (By.CSS_SELECTOR, ".stat-card")
    ROUND_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(1) .stat-value")
    ITEMS_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(2) .stat-value")
    TIME_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(3) .stat-value")
    RANK_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(4) .stat-value")
    
    # Форма ставки
    BID_CARD = (By.CSS_SELECTOR, ".bid-card")
    YOUR_BID_SECTION = (By.CSS_SELECTOR, ".your-bid")
    YOUR_BID_VALUE = (By.CSS_SELECTOR, ".your-bid-value")
    YOUR_BID_RANK = (By.CSS_SELECTOR, ".your-bid-rank")
    BID_INPUT = (By.CSS_SELECTOR, ".bid-input-wrapper input")
    BID_BUTTON = (By.CSS_SELECTOR, ".bid-card .btn-primary")
    BID_ERROR = (By.CSS_SELECTOR, ".bid-card .alert-error")
    BID_SUCCESS = (By.CSS_SELECTOR, ".bid-card .alert-success")
    
    # Топ ставки
    TOP_BIDS_CARD = (By.CSS_SELECTOR, ".card:has(.top-bids-list), .card h2:contains('Топ ставки')")
    TOP_BIDS_LIST = (By.CSS_SELECTOR, ".top-bids-list")
    BID_ROWS = (By.CSS_SELECTOR, ".bid-row")
    EMPTY_BIDS = (By.CSS_SELECTOR, ".empty-bids")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/auctions"
    
    def open(self, auction_id: str) -> "AuctionDetailPage":
        """Открыть страницу конкретного аукциона."""
        super().open(f"{self.path}/{auction_id}")
        self.wait_for_spinner_disappear()
        return self
    
    def is_loading(self) -> bool:
        """Проверить, загружается ли страница."""
        return self.is_element_visible(self.LOADING_STATE, timeout=1)
    
    def is_error(self) -> bool:
        """Проверить, есть ли ошибка загрузки."""
        return self.is_element_visible(self.ERROR_STATE, timeout=2)
    
    def get_auction_title(self) -> str:
        """Получить название аукциона."""
        return self.get_text(self.AUCTION_TITLE)
    
    def get_auction_description(self) -> str:
        """Получить описание аукциона."""
        return self.get_text(self.AUCTION_DESCRIPTION)
    
    def get_auction_status(self) -> str:
        """Получить статус аукциона."""
        return self.get_text(self.STATUS_BADGE)
    
    def get_auction_currency(self) -> str:
        """Получить валюту аукциона."""
        return self.get_text(self.CURRENCY_BADGE)
    
    def get_min_bid(self) -> str:
        """Получить минимальную ставку."""
        return self.get_text(self.MIN_BID_VALUE)
    
    def is_min_bid_visible(self) -> bool:
        """Проверить видимость минимальной ставки."""
        return self.is_element_visible(self.MIN_BID_SECTION)
    
    def get_current_round(self) -> str:
        """Получить текущий раунд."""
        return self.get_text(self.ROUND_STAT)
    
    def get_items_sold(self) -> str:
        """Получить информацию о проданных лотах."""
        return self.get_text(self.ITEMS_STAT)
    
    def is_bid_card_visible(self) -> bool:
        """Проверить видимость формы ставки (для активных аукционов)."""
        return self.is_element_visible(self.BID_CARD, timeout=2)
    
    def has_existing_bid(self) -> bool:
        """Проверить, есть ли у пользователя ставка."""
        return self.is_element_visible(self.YOUR_BID_SECTION, timeout=2)
    
    def get_your_bid_amount(self) -> str:
        """Получить сумму вашей ставки."""
        return self.get_text(self.YOUR_BID_VALUE)
    
    def get_your_bid_rank(self) -> str:
        """Получить место вашей ставки."""
        return self.get_text(self.YOUR_BID_RANK)
    
    def is_winning(self) -> bool:
        """Проверить, в зоне ли победы ваша ставка."""
        rank_text = self.get_your_bid_rank()
        return "В зоне победы" in rank_text
    
    def enter_bid_amount(self, amount: str) -> "AuctionDetailPage":
        """Ввести сумму ставки."""
        self.type_text(self.BID_INPUT, amount)
        return self
    
    def click_place_bid(self) -> None:
        """Нажать кнопку размещения ставки."""
        self.click(self.BID_BUTTON)
    
    def place_bid(self, amount: str) -> None:
        """
        Разместить ставку с указанной суммой.
        """
        self.enter_bid_amount(amount)
        self.click_place_bid()
    
    def is_bid_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка ставки."""
        button = self.find_element(self.BID_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def get_bid_button_text(self) -> str:
        """Получить текст кнопки ставки."""
        return self.get_text(self.BID_BUTTON)
    
    def is_bid_error_displayed(self) -> bool:
        """Проверить, отображается ли ошибка ставки."""
        return self.is_element_visible(self.BID_ERROR, timeout=3)
    
    def get_bid_error_message(self) -> str:
        """Получить текст ошибки ставки."""
        return self.get_text(self.BID_ERROR)
    
    def is_bid_success_displayed(self) -> bool:
        """Проверить, отображается ли успех ставки."""
        return self.is_element_visible(self.BID_SUCCESS, timeout=5)
    
    def get_bid_success_message(self) -> str:
        """Получить текст успешного сообщения о ставке."""
        return self.get_text(self.BID_SUCCESS)
    
    def wait_for_bid_result(self, timeout: int = 5) -> str:
        """
        Ожидание результата ставки.
        Возвращает 'success', 'error' или 'timeout'.
        """
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.is_bid_success_displayed():
                return "success"
            if self.is_bid_error_displayed():
                return "error"
            time.sleep(0.5)
        
        return "timeout"
    
    def get_top_bids(self) -> List[dict]:
        """
        Получить список топ ставок.
        """
        bids = []
        try:
            rows = self.find_elements(self.BID_ROWS)
            for row in rows:
                bid = {
                    "rank": row.find_element(By.CSS_SELECTOR, ".bid-rank").text,
                    "user": row.find_element(By.CSS_SELECTOR, ".bid-user").text,
                    "amount": row.find_element(By.CSS_SELECTOR, ".bid-amount").text,
                    "winning": "winning" in row.get_attribute("class")
                }
                bids.append(bid)
        except:
            pass
        return bids
    
    def get_top_bids_count(self) -> int:
        """Получить количество топ ставок."""
        return len(self.get_top_bids())
    
    def is_bids_empty(self) -> bool:
        """Проверить, пустой ли список ставок."""
        return self.is_element_visible(self.EMPTY_BIDS, timeout=2)
    
    def get_leading_bid(self) -> Optional[dict]:
        """Получить лидирующую ставку."""
        bids = self.get_top_bids()
        if bids:
            return bids[0]
        return None
    
    def clear_bid_input(self) -> "AuctionDetailPage":
        """Очистить поле ввода ставки."""
        bid_input = self.find_element(self.BID_INPUT)
        bid_input.clear()
        return self
    
    def get_bid_input_value(self) -> str:
        """Получить текущее значение поля ставки."""
        return self.get_attribute(self.BID_INPUT, "value")
    
    def get_bid_input_placeholder(self) -> str:
        """Получить placeholder поля ставки."""
        return self.get_attribute(self.BID_INPUT, "placeholder")
