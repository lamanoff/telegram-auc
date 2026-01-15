"""
Page Object для админ панели.
"""
import time
from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from typing import List, Dict


class AdminPage(BasePage):
    """
    Page Object для админ панели (Admin).
    """
    
    # Локаторы
    PAGE_TITLE = (By.CSS_SELECTOR, ".admin-page h1")
    
    # Табы
    TABS = (By.CSS_SELECTOR, ".tabs .tab")
    TAB_STATS = (By.CSS_SELECTOR, ".tab:contains('Статистика'), .tabs button:nth-child(1)")
    TAB_AUCTIONS = (By.CSS_SELECTOR, ".tabs button:nth-child(2)")
    TAB_TRANSACTIONS = (By.CSS_SELECTOR, ".tabs button:nth-child(3)")
    TAB_EVENTS = (By.CSS_SELECTOR, ".tabs button:nth-child(4)")
    TAB_CREATE = (By.CSS_SELECTOR, ".tabs button:nth-child(5)")
    ACTIVE_TAB = (By.CSS_SELECTOR, ".tab.active")
    
    # Stats tab
    STATS_GRID = (By.CSS_SELECTOR, ".stats-grid")
    STAT_CARDS = (By.CSS_SELECTOR, ".stat-card")
    USERS_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(1) .stat-value")
    AUCTIONS_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(2) .stat-value")
    BIDS_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(3) .stat-value")
    TRANSACTIONS_STAT = (By.CSS_SELECTOR, ".stat-card:nth-child(4) .stat-value")
    VOLUME_GRID = (By.CSS_SELECTOR, ".volume-grid")
    VOLUME_CARDS = (By.CSS_SELECTOR, ".volume-card")
    
    # Auctions tab
    AUCTIONS_TABLE = (By.CSS_SELECTOR, ".data-table")
    AUCTION_ROWS = (By.CSS_SELECTOR, ".data-table tbody tr")
    REFRESH_BUTTON = (By.CSS_SELECTOR, ".card-header .btn-secondary")
    CANCEL_AUCTION_BUTTONS = (By.CSS_SELECTOR, ".btn-danger")
    VIEW_AUCTION_BUTTONS = (By.CSS_SELECTOR, ".actions .btn-secondary")
    
    # Create auction form
    CREATE_FORM = (By.CSS_SELECTOR, ".auction-form")
    # Ищем первый input в форме (это title)
    TITLE_INPUT = (By.CSS_SELECTOR, ".auction-form .form-section:first-child .form-group:first-child input")
    DESCRIPTION_TEXTAREA = (By.CSS_SELECTOR, ".auction-form textarea")
    CURRENCY_SELECT = (By.CSS_SELECTOR, ".auction-form select")
    STARTING_PRICE_INPUT = (By.CSS_SELECTOR, ".auction-form input[placeholder='1.0']")
    MIN_INCREMENT_INPUT = (By.CSS_SELECTOR, ".auction-form input[placeholder='0.1']")
    RESERVE_PRICE_INPUT = (By.CSS_SELECTOR, "input[placeholder='Не установлена']")
    ROUNDS_COUNT_INPUT = (By.CSS_SELECTOR, "input[placeholder='5']")
    ITEMS_PER_ROUND_INPUT = (By.CSS_SELECTOR, "input[placeholder='10']")
    TOTAL_ITEMS_INPUT = (By.CSS_SELECTOR, "input[placeholder*='50']")
    START_TIME_INPUT = (By.CSS_SELECTOR, "input[type='datetime-local']")
    FIRST_ROUND_DURATION_INPUT = (By.CSS_SELECTOR, ".form-section:nth-child(4) input[placeholder='300']:first-of-type")
    ROUND_DURATION_INPUT = (By.CSS_SELECTOR, ".form-section:nth-child(4) input[placeholder='300']:last-of-type")
    CREATE_BUTTON = (By.CSS_SELECTOR, ".form-actions .btn-primary")
    CREATE_ERROR = (By.CSS_SELECTOR, ".auction-form .alert-error")
    CREATE_SUCCESS = (By.CSS_SELECTOR, ".auction-form .alert-success")
    CREATED_AUCTION_ID = (By.CSS_SELECTOR, ".auction-form .alert-success code")
    
    # Transactions tab
    TRANSACTIONS_TABLE = (By.CSS_SELECTOR, ".tab-content:has(.data-table) .data-table")
    TRANSACTION_ROWS = (By.CSS_SELECTOR, ".data-table tbody tr")
    
    # Events tab
    EVENTS_TABLE = (By.CSS_SELECTOR, ".tab-content:has(.data-table) .data-table")
    EVENT_ROWS = (By.CSS_SELECTOR, ".data-table tbody tr")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/admin"
    
    def open(self) -> "AdminPage":
        """Открыть страницу админ панели."""
        super().open(self.path)
        return self
    
    def get_page_title(self) -> str:
        """Получить заголовок страницы."""
        return self.get_text(self.PAGE_TITLE)
    
    # Методы работы с табами
    def get_tabs(self) -> List[str]:
        """Получить список табов."""
        tabs = self.find_elements(self.TABS)
        return [tab.text for tab in tabs]
    
    def get_active_tab(self) -> str:
        """Получить текст активного таба."""
        return self.get_text(self.ACTIVE_TAB)
    
    def click_stats_tab(self) -> None:
        """Переключиться на таб статистики."""
        tabs = self.find_elements(self.TABS)
        if tabs:
            tabs[0].click()
    
    def _click_tab(self, index: int) -> None:
        """Кликнуть по табу с индексом, используя JavaScript для избежания перекрытия."""
        tabs = self.find_elements(self.TABS)
        if len(tabs) > index:
            # Скролл к элементу и клик через JS для избежания ElementClickInterceptedException
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", tabs[index])
            self.driver.execute_script("arguments[0].click();", tabs[index])
    
    def click_auctions_tab(self) -> None:
        """Переключиться на таб аукционов."""
        self._click_tab(1)
    
    def click_transactions_tab(self) -> None:
        """Переключиться на таб транзакций."""
        self._click_tab(2)
    
    def click_events_tab(self) -> None:
        """Переключиться на таб событий."""
        self._click_tab(3)
    
    def click_create_tab(self) -> None:
        """Переключиться на таб создания аукциона."""
        self._click_tab(4)
    
    # Методы работы со статистикой
    def get_users_count(self) -> str:
        """Получить количество пользователей."""
        return self.get_text(self.USERS_STAT)
    
    def get_auctions_count(self) -> str:
        """Получить количество аукционов."""
        return self.get_text(self.AUCTIONS_STAT)
    
    def get_bids_count(self) -> str:
        """Получить количество ставок."""
        return self.get_text(self.BIDS_STAT)
    
    def get_transactions_count(self) -> str:
        """Получить количество транзакций."""
        return self.get_text(self.TRANSACTIONS_STAT)
    
    def is_stats_grid_visible(self) -> bool:
        """Проверить видимость статистики."""
        return self.is_element_visible(self.STATS_GRID)
    
    def get_volume_info(self) -> List[Dict]:
        """Получить информацию о объёмах."""
        volumes = []
        try:
            cards = self.find_elements(self.VOLUME_CARDS)
            for card in cards:
                volume = {
                    "currency": card.find_element(By.CSS_SELECTOR, ".currency-badge").text,
                    "amount": card.find_element(By.CSS_SELECTOR, ".volume-amount").text
                }
                volumes.append(volume)
        except:
            pass
        return volumes
    
    # Методы работы с аукционами
    def get_auctions_list(self) -> List[Dict]:
        """Получить список аукционов из таблицы."""
        auctions = []
        try:
            rows = self.find_elements(self.AUCTION_ROWS)
            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 5:
                    auction = {
                        "title": cells[0].text,
                        "status": cells[1].text,
                        "round": cells[2].text,
                        "items": cells[3].text,
                        "currency": cells[4].text
                    }
                    auctions.append(auction)
        except:
            pass
        return auctions
    
    def click_refresh_auctions(self) -> None:
        """Нажать кнопку обновления списка аукционов."""
        self.click(self.REFRESH_BUTTON)
    
    def cancel_auction_by_index(self, index: int) -> None:
        """Отменить аукцион по индексу."""
        buttons = self.find_elements(self.CANCEL_AUCTION_BUTTONS)
        if len(buttons) > index:
            buttons[index].click()
    
    def view_auction_by_index(self, index: int) -> None:
        """Открыть аукцион по индексу."""
        buttons = self.find_elements(self.VIEW_AUCTION_BUTTONS)
        if len(buttons) > index:
            buttons[index].click()
    
    # Методы создания аукциона
    def fill_auction_form(
        self,
        title: str,
        description: str = "",
        currency: str = "TON",
        starting_price: str = "1",
        min_increment: str = "0.1",
        rounds_count: str = "5",
        items_per_round: str = "10",
        start_time: str = "",
        first_round_duration: str = "300",
        round_duration: str = "300",
        reserve_price: str = ""
    ) -> "AdminPage":
        """
        Заполнить форму создания аукциона.
        """
        # Ждём появления формы
        self.wait_for_element_visible(self.CREATE_FORM, timeout=10)
        time.sleep(1)  # Даём форме полностью отрендериться
        
        # Заполняем название через JavaScript для надёжности
        self.driver.execute_script("""
            const form = document.querySelector('.auction-form');
            const inputs = form.querySelectorAll('input[type="text"]');
            if (inputs.length > 0) {
                inputs[0].value = arguments[0];
                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
        """, title)
        
        if description:
            self.type_text(self.DESCRIPTION_TEXTAREA, description)
        
        self.select_dropdown_option(self.CURRENCY_SELECT, currency)
        self.type_text(self.STARTING_PRICE_INPUT, starting_price)
        self.type_text(self.MIN_INCREMENT_INPUT, min_increment)
        
        if reserve_price:
            self.type_text(self.RESERVE_PRICE_INPUT, reserve_price)
        
        self.type_text(self.ROUNDS_COUNT_INPUT, rounds_count)
        self.type_text(self.ITEMS_PER_ROUND_INPUT, items_per_round)

        if start_time:
            # Используем специальный метод для datetime-local input
            self.set_datetime_input(self.START_TIME_INPUT, start_time)

        self.type_text(self.FIRST_ROUND_DURATION_INPUT, first_round_duration)
        self.type_text(self.ROUND_DURATION_INPUT, round_duration)
        
        return self
    
    def click_create_auction(self) -> None:
        """Нажать кнопку создания аукциона."""
        self.click(self.CREATE_BUTTON)
    
    def is_create_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка создания."""
        button = self.find_element(self.CREATE_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def get_create_button_text(self) -> str:
        """Получить текст кнопки создания."""
        return self.get_text(self.CREATE_BUTTON)
    
    def is_create_error_displayed(self) -> bool:
        """Проверить, отображается ли ошибка создания."""
        return self.is_element_visible(self.CREATE_ERROR, timeout=5)
    
    def get_create_error_message(self) -> str:
        """Получить текст ошибки создания."""
        return self.get_text(self.CREATE_ERROR)
    
    def is_create_success_displayed(self) -> bool:
        """Проверить, отображается ли успешное создание."""
        # Ждём до 15 секунд, т.к. создание может занять время
        return self.is_element_visible(self.CREATE_SUCCESS, timeout=15)
    
    def get_created_auction_id(self) -> str:
        """Получить ID созданного аукциона."""
        return self.get_text(self.CREATED_AUCTION_ID)
    
    def create_auction(
        self,
        title: str,
        description: str = "",
        currency: str = "TON",
        starting_price: str = "1",
        min_increment: str = "0.1",
        rounds_count: str = "5",
        items_per_round: str = "10",
        start_time: str = "",
        first_round_duration: str = "300",
        round_duration: str = "300"
    ) -> bool:
        """
        Создать аукцион с указанными параметрами.
        Возвращает True если успешно.
        """
        self.fill_auction_form(
            title=title,
            description=description,
            currency=currency,
            starting_price=starting_price,
            min_increment=min_increment,
            rounds_count=rounds_count,
            items_per_round=items_per_round,
            start_time=start_time,
            first_round_duration=first_round_duration,
            round_duration=round_duration
        )
        self.click_create_auction()
        
        # Ждём ответа сервера
        time.sleep(3)

        return self.is_create_success_displayed()
    
    # Методы работы с транзакциями
    def get_transactions_list(self) -> List[Dict]:
        """Получить список транзакций из таблицы."""
        transactions = []
        try:
            rows = self.find_elements(self.TRANSACTION_ROWS)
            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 6:
                    tx = {
                        "id": cells[0].text,
                        "type": cells[1].text,
                        "amount": cells[2].text,
                        "status": cells[3].text,
                        "provider": cells[4].text,
                        "date": cells[5].text
                    }
                    transactions.append(tx)
        except:
            pass
        return transactions
    
    # Методы работы с событиями
    def get_events_list(self) -> List[Dict]:
        """Получить список событий из таблицы."""
        events = []
        try:
            rows = self.find_elements(self.EVENT_ROWS)
            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 5:
                    event = {
                        "type": cells[0].text,
                        "user_id": cells[1].text,
                        "auction_id": cells[2].text,
                        "payload": cells[3].text,
                        "date": cells[4].text
                    }
                    events.append(event)
        except:
            pass
        return events
