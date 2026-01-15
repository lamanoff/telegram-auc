"""
Page Object для страницы профиля пользователя.
"""
from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from typing import List, Dict


class ProfilePage(BasePage):
    """
    Page Object для страницы профиля (Profile).
    """
    
    # Локаторы
    PAGE_TITLE = (By.CSS_SELECTOR, ".profile-page h1")
    
    # Balance секция
    BALANCE_SECTION = (By.CSS_SELECTOR, ".balance-section")
    BALANCE_CARDS = (By.CSS_SELECTOR, ".balance-card")
    
    # TON баланс
    TON_BALANCE_TOTAL = (By.CSS_SELECTOR, ".balance-card:first-child .balance-total")
    TON_AVAILABLE = (By.CSS_SELECTOR, ".balance-card:first-child .available")
    TON_LOCKED = (By.CSS_SELECTOR, ".balance-card:first-child .locked")
    
    # USDT баланс
    USDT_BALANCE_TOTAL = (By.CSS_SELECTOR, ".balance-card:last-child .balance-total")
    USDT_AVAILABLE = (By.CSS_SELECTOR, ".balance-card:last-child .available")
    USDT_LOCKED = (By.CSS_SELECTOR, ".balance-card:last-child .locked")
    
    # Депозит форма
    DEPOSIT_CARD = (By.CSS_SELECTOR, ".actions-grid .card:first-child")
    DEPOSIT_CURRENCY_SELECT = (By.CSS_SELECTOR, ".actions-grid .card:first-child select")
    DEPOSIT_AMOUNT_INPUT = (By.CSS_SELECTOR, ".actions-grid .card:first-child input[type='number']")
    DEPOSIT_BUTTON = (By.CSS_SELECTOR, ".actions-grid .card:first-child .btn-primary")
    DEPOSIT_SUCCESS = (By.CSS_SELECTOR, ".actions-grid .card:first-child .alert-success")
    DEPOSIT_LINK = (By.CSS_SELECTOR, ".actions-grid .card:first-child .alert-success a")
    
    # Вывод форма
    WITHDRAW_CARD = (By.CSS_SELECTOR, ".actions-grid .card:last-child")
    WITHDRAW_CURRENCY_SELECT = (By.CSS_SELECTOR, ".actions-grid .card:last-child select")
    WITHDRAW_AMOUNT_INPUT = (By.CSS_SELECTOR, ".actions-grid .card:last-child input[type='number']")
    WITHDRAW_ADDRESS_INPUT = (By.CSS_SELECTOR, ".actions-grid .card:last-child input[type='text']")
    WITHDRAW_BUTTON = (By.CSS_SELECTOR, ".actions-grid .card:last-child .btn-danger")
    
    # Транзакции
    TRANSACTIONS_CARD = (By.CSS_SELECTOR, ".profile-page > .card:last-child")
    TRANSACTIONS_TABLE = (By.CSS_SELECTOR, ".transactions-table")
    TRANSACTIONS_LOADING = (By.CSS_SELECTOR, ".transactions-table + .loading-state, .card:last-child .spinner")
    TRANSACTIONS_EMPTY = (By.CSS_SELECTOR, ".card:last-child .empty-state")
    TRANSACTION_ROWS = (By.CSS_SELECTOR, ".transactions-table tbody tr")
    
    def __init__(self, driver, base_url: str):
        super().__init__(driver, base_url)
        self.path = "/profile"
    
    def open(self) -> "ProfilePage":
        """Открыть страницу профиля."""
        super().open(self.path)
        self.wait_for_spinner_disappear()
        return self
    
    def get_page_title(self) -> str:
        """Получить заголовок страницы."""
        return self.get_text(self.PAGE_TITLE)
    
    # Методы работы с балансом
    def get_ton_total_balance(self) -> str:
        """Получить общий баланс TON."""
        return self.get_text(self.TON_BALANCE_TOTAL)
    
    def get_ton_available_balance(self) -> str:
        """Получить доступный баланс TON."""
        return self.get_text(self.TON_AVAILABLE)
    
    def get_ton_locked_balance(self) -> str:
        """Получить заблокированный баланс TON."""
        return self.get_text(self.TON_LOCKED)
    
    def get_usdt_total_balance(self) -> str:
        """Получить общий баланс USDT."""
        return self.get_text(self.USDT_BALANCE_TOTAL)
    
    def get_usdt_available_balance(self) -> str:
        """Получить доступный баланс USDT."""
        return self.get_text(self.USDT_AVAILABLE)
    
    def get_usdt_locked_balance(self) -> str:
        """Получить заблокированный баланс USDT."""
        return self.get_text(self.USDT_LOCKED)
    
    def get_balance_cards_count(self) -> int:
        """Получить количество карточек баланса."""
        return len(self.find_elements(self.BALANCE_CARDS))
    
    # Методы работы с депозитом
    def select_deposit_currency(self, currency: str) -> "ProfilePage":
        """Выбрать валюту депозита."""
        self.select_dropdown_option(self.DEPOSIT_CURRENCY_SELECT, currency)
        return self
    
    def enter_deposit_amount(self, amount: str) -> "ProfilePage":
        """Ввести сумму депозита."""
        self.type_text(self.DEPOSIT_AMOUNT_INPUT, amount)
        return self
    
    def click_create_deposit(self) -> None:
        """Нажать кнопку создания депозита."""
        self.click(self.DEPOSIT_BUTTON)
    
    def create_deposit(self, currency: str, amount: str) -> None:
        """
        Создать депозит с указанными параметрами.
        """
        self.select_deposit_currency(currency)
        self.enter_deposit_amount(amount)
        self.click_create_deposit()
    
    def is_deposit_success_displayed(self) -> bool:
        """Проверить, отображается ли успешный депозит."""
        return self.is_element_visible(self.DEPOSIT_SUCCESS, timeout=10)
    
    def get_deposit_payment_link(self) -> str:
        """Получить ссылку на оплату депозита."""
        return self.get_attribute(self.DEPOSIT_LINK, "href")
    
    def is_deposit_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка депозита."""
        button = self.find_element(self.DEPOSIT_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def get_deposit_button_text(self) -> str:
        """Получить текст кнопки депозита."""
        return self.get_text(self.DEPOSIT_BUTTON)
    
    # Методы работы с выводом
    def select_withdraw_currency(self, currency: str) -> "ProfilePage":
        """Выбрать валюту вывода."""
        self.select_dropdown_option(self.WITHDRAW_CURRENCY_SELECT, currency)
        return self
    
    def enter_withdraw_amount(self, amount: str) -> "ProfilePage":
        """Ввести сумму вывода."""
        self.type_text(self.WITHDRAW_AMOUNT_INPUT, amount)
        return self
    
    def enter_withdraw_address(self, address: str) -> "ProfilePage":
        """Ввести адрес для вывода."""
        self.type_text(self.WITHDRAW_ADDRESS_INPUT, address)
        return self
    
    def click_withdraw(self) -> None:
        """Нажать кнопку вывода."""
        self.click(self.WITHDRAW_BUTTON)
    
    def create_withdraw(self, currency: str, amount: str, address: str) -> None:
        """
        Создать запрос на вывод с указанными параметрами.
        """
        self.select_withdraw_currency(currency)
        self.enter_withdraw_amount(amount)
        self.enter_withdraw_address(address)
        self.click_withdraw()
    
    def is_withdraw_button_disabled(self) -> bool:
        """Проверить, заблокирована ли кнопка вывода."""
        button = self.find_element(self.WITHDRAW_BUTTON)
        return button.get_attribute("disabled") is not None
    
    def get_withdraw_button_text(self) -> str:
        """Получить текст кнопки вывода."""
        return self.get_text(self.WITHDRAW_BUTTON)
    
    # Методы работы с транзакциями
    def is_transactions_loading(self) -> bool:
        """Проверить, загружаются ли транзакции."""
        return self.is_element_visible(self.TRANSACTIONS_LOADING, timeout=1)
    
    def is_transactions_empty(self) -> bool:
        """Проверить, пустой ли список транзакций."""
        return self.is_element_visible(self.TRANSACTIONS_EMPTY, timeout=3)
    
    def get_transactions_count(self) -> int:
        """Получить количество транзакций."""
        try:
            rows = self.find_elements(self.TRANSACTION_ROWS)
            return len(rows)
        except:
            return 0
    
    def get_transactions(self) -> List[Dict]:
        """
        Получить список транзакций.
        """
        transactions = []
        try:
            rows = self.find_elements(self.TRANSACTION_ROWS)
            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 5:
                    tx = {
                        "type": cells[0].text,
                        "currency": cells[1].text,
                        "amount": cells[2].text,
                        "status": cells[3].text,
                        "date": cells[4].text
                    }
                    transactions.append(tx)
        except:
            pass
        return transactions
    
    def get_latest_transaction(self) -> Dict:
        """Получить последнюю транзакцию."""
        transactions = self.get_transactions()
        if transactions:
            return transactions[0]
        return {}
    
    def wait_for_transactions_loaded(self, timeout: int = 10) -> bool:
        """Ожидание загрузки транзакций."""
        try:
            self.wait_for_element_invisible(self.TRANSACTIONS_LOADING, timeout)
            return True
        except:
            return False
    
    def clear_deposit_form(self) -> "ProfilePage":
        """Очистить форму депозита."""
        deposit_input = self.find_element(self.DEPOSIT_AMOUNT_INPUT)
        deposit_input.clear()
        return self
    
    def clear_withdraw_form(self) -> "ProfilePage":
        """Очистить форму вывода."""
        amount_input = self.find_element(self.WITHDRAW_AMOUNT_INPUT)
        address_input = self.find_element(self.WITHDRAW_ADDRESS_INPUT)
        amount_input.clear()
        address_input.clear()
        return self
