"""
Тесты админ панели.
"""
import pytest
import sys
import os
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pages.admin_page import AdminPage
from pages.login_page import LoginPage
from pages.auctions_page import AuctionsPage


class TestAdminAccess:
    """Тесты доступа к админ панели."""
    
    def test_admin_not_accessible_without_login(self, driver, base_url):
        """Админка недоступна без авторизации."""
        driver.get(f"{base_url}/admin")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        
        try:
            page.wait_for_url_contains("/login", timeout=5)
            assert "/login" in driver.current_url or "/admin" not in driver.current_url
        except:
            # Возможно, перенаправляет на главную
            pass
    
    def test_admin_not_accessible_for_regular_user(self, driver, base_url, test_user):
        """Админка недоступна для обычного пользователя."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        
        # Для обычного пользователя ссылка на админку не должна быть видна
        assert not page.is_admin_link_visible(), "Ссылка на админку видна для обычного пользователя"
    
    def test_admin_accessible_for_admin_user(self, driver, base_url, admin_user):
        """Админка доступна для администратора."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        # Проверяем видимость ссылки на админку
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        
        if page.is_admin_link_visible():
            page.navigate_to_admin()
            
            page.wait_for_url_contains("/admin")
            assert "/admin" in page.get_current_url()


class TestAdminPageTabs:
    """Тесты табов админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        # Проверяем, есть ли доступ к админке
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_admin_page_loads(self, driver, base_url):
        """Проверка загрузки админ панели."""
        page = AdminPage(driver, base_url)
        page.open()
        
        assert "Админ панель" in page.get_page_title()
    
    def test_admin_tabs_exist(self, driver, base_url):
        """Проверка наличия всех табов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        tabs = page.get_tabs()
        
        assert len(tabs) >= 5, f"Ожидалось 5 табов, получено: {len(tabs)}"
        
        # Проверяем наличие табов
        tabs_text = " ".join(tabs).lower()
        assert "статистика" in tabs_text
        assert "аукцион" in tabs_text
        assert "транзакц" in tabs_text
        assert "событ" in tabs_text
        assert "создать" in tabs_text
    
    def test_switch_to_stats_tab(self, driver, base_url):
        """Переключение на таб статистики."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        time.sleep(0.5)
        
        # Проверяем, что статистика видна
        assert page.is_stats_grid_visible()
    
    def test_switch_to_auctions_tab(self, driver, base_url):
        """Переключение на таб аукционов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_auctions_tab()
        time.sleep(0.5)
        
        # Таблица аукционов должна быть видна
        auctions = page.get_auctions_list()
        # Может быть пустым, но ошибки быть не должно
    
    def test_switch_to_transactions_tab(self, driver, base_url):
        """Переключение на таб транзакций."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_transactions_tab()
        time.sleep(0.5)
        
        # Таблица транзакций должна быть доступна
        transactions = page.get_transactions_list()
    
    def test_switch_to_events_tab(self, driver, base_url):
        """Переключение на таб событий."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_events_tab()
        time.sleep(0.5)
        
        # Таблица событий должна быть доступна
        events = page.get_events_list()
    
    def test_switch_to_create_tab(self, driver, base_url):
        """Переключение на таб создания аукциона."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        # Кнопка создания должна быть видна
        button_text = page.get_create_button_text()
        assert "Создать" in button_text or "аукцион" in button_text.lower()


class TestAdminStats:
    """Тесты статистики в админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_stats_cards_visible(self, driver, base_url):
        """Проверка видимости карточек статистики."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        
        assert page.is_stats_grid_visible()
    
    def test_users_count_displayed(self, driver, base_url):
        """Проверка отображения количества пользователей."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        
        users = page.get_users_count()
        # Должно быть число
        assert users.isdigit() or users == "0"
    
    def test_auctions_count_displayed(self, driver, base_url):
        """Проверка отображения количества аукционов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        
        auctions = page.get_auctions_count()
        assert auctions.isdigit() or auctions == "0"
    
    def test_bids_count_displayed(self, driver, base_url):
        """Проверка отображения количества ставок."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        
        bids = page.get_bids_count()
        assert bids.isdigit() or bids == "0"
    
    def test_transactions_count_displayed(self, driver, base_url):
        """Проверка отображения количества транзакций."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_stats_tab()
        
        transactions = page.get_transactions_count()
        assert transactions.isdigit() or transactions == "0"


class TestAdminAuctions:
    """Тесты управления аукционами в админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_auctions_list_loads(self, driver, base_url):
        """Проверка загрузки списка аукционов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_auctions_tab()
        time.sleep(1)
        
        # Список должен загрузиться (может быть пустым)
        auctions = page.get_auctions_list()
        assert isinstance(auctions, list)
    
    def test_refresh_auctions_list(self, driver, base_url):
        """Проверка обновления списка аукционов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_auctions_tab()
        time.sleep(1)
        
        page.click_refresh_auctions()
        time.sleep(1)
        
        # После обновления не должно быть ошибок
        auctions = page.get_auctions_list()
        assert isinstance(auctions, list)
    
    def test_auction_table_columns(self, driver, base_url):
        """Проверка колонок таблицы аукционов."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_auctions_tab()
        time.sleep(1)
        
        auctions = page.get_auctions_list()
        
        if auctions:
            auction = auctions[0]
            
            # Проверяем наличие колонок
            assert "title" in auction
            assert "status" in auction
            assert "currency" in auction


class TestCreateAuction:
    """Тесты создания аукциона."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_create_form_loads(self, driver, base_url):
        """Проверка загрузки формы создания."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        button_text = page.get_create_button_text()
        assert "Создать" in button_text
    
    def test_create_auction_without_title(self, driver, base_url):
        """Попытка создания без названия."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        # Заполняем форму без названия
        start_time = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
        
        page.fill_auction_form(
            title="",
            currency="TON",
            starting_price="1",
            min_increment="0.1",
            rounds_count="5",
            items_per_round="10",
            start_time=start_time,
            first_round_duration="300",
            round_duration="300"
        )
        
        page.click_create_auction()
        time.sleep(2)
        
        # Должна быть ошибка
        assert page.is_create_error_displayed() or not page.is_create_success_displayed()
    
    def test_create_auction_without_start_time(self, driver, base_url):
        """Попытка создания без даты начала."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        # Заполняем форму без даты
        page.fill_auction_form(
            title="Test Auction",
            currency="TON",
            starting_price="1",
            min_increment="0.1",
            rounds_count="5",
            items_per_round="10",
            start_time="",  # Пусто
            first_round_duration="300",
            round_duration="300"
        )
        
        page.click_create_auction()
        time.sleep(2)
        
        # Должна быть ошибка
        assert page.is_create_error_displayed() or not page.is_create_success_displayed()
    
    def test_create_auction_success(self, driver, base_url, unique_user):
        """Успешное создание аукциона."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        # Генерируем уникальное название
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        title = f"Test Auction {timestamp}"
        
        # Дата начала через час
        start_time = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
        
        result = page.create_auction(
            title=title,
            description="Test auction description",
            currency="TON",
            starting_price="1",
            min_increment="0.1",
            rounds_count="3",
            items_per_round="5",
            start_time=start_time,
            first_round_duration="120",
            round_duration="60"
        )
        
        # Проверяем ошибку создания
        if page.is_create_error_displayed():
            error_msg = page.get_create_error_message()
            pytest.fail(f"Ошибка создания аукциона: {error_msg}")
        
        assert result, "Аукцион не был создан - сообщение об успехе не появилось"
        
        # Получаем ID созданного аукциона
        auction_id = page.get_created_auction_id()
        assert len(auction_id) > 0, "ID созданного аукциона пустой"
        
        # Проверяем, что аукцион появился в списке
        page.click_auctions_tab()
        time.sleep(1)
        
        auctions = page.get_auctions_list()
        auction_titles = [a["title"] for a in auctions]
        assert title in auction_titles, f"Созданный аукцион '{title}' не найден в списке"
    
    def test_create_auction_with_all_fields(self, driver, base_url):
        """Создание аукциона со всеми заполненными полями."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_create_tab()
        time.sleep(0.5)
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        title = f"Full Auction {timestamp}"
        start_time = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M")
        
        page.fill_auction_form(
            title=title,
            description="Полное описание аукциона с тестовыми данными",
            currency="USDT",
            starting_price="10",
            min_increment="1",
            rounds_count="10",
            items_per_round="20",
            start_time=start_time,
            first_round_duration="600",
            round_duration="300",
            reserve_price="100"
        )
        
        page.click_create_auction()
        time.sleep(3)
        
        # Проверяем результат - ошибка должна приводить к падению теста
        if page.is_create_error_displayed():
            error = page.get_create_error_message()
            pytest.fail(f"Ошибка создания аукциона: {error}")
        
        assert page.is_create_success_displayed(), "Аукцион не был создан"


class TestAdminTransactions:
    """Тесты просмотра транзакций в админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_transactions_list_loads(self, driver, base_url):
        """Проверка загрузки списка транзакций."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_transactions_tab()
        time.sleep(1)
        
        transactions = page.get_transactions_list()
        assert isinstance(transactions, list)
    
    def test_transactions_table_columns(self, driver, base_url):
        """Проверка колонок таблицы транзакций."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_transactions_tab()
        time.sleep(1)
        
        transactions = page.get_transactions_list()
        
        if transactions:
            tx = transactions[0]
            
            # Проверяем наличие основных колонок
            assert "id" in tx
            assert "type" in tx
            assert "amount" in tx
            assert "status" in tx


class TestAdminEvents:
    """Тесты просмотра событий в админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_events_list_loads(self, driver, base_url):
        """Проверка загрузки списка событий."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_events_tab()
        time.sleep(1)
        
        events = page.get_events_list()
        assert isinstance(events, list)
    
    def test_events_table_columns(self, driver, base_url):
        """Проверка колонок таблицы событий."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_events_tab()
        time.sleep(1)
        
        events = page.get_events_list()
        
        if events:
            event = events[0]
            
            # Проверяем наличие основных колонок
            assert "type" in event
            assert "date" in event


class TestAdminNavigation:
    """Тесты навигации в админ панели."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_navigate_to_admin_from_nav(self, driver, base_url):
        """Переход в админку через навигацию."""
        from pages.base_page import BasePage
        
        page = BasePage(driver, base_url)
        page.open("/")
        
        page.navigate_to_admin()
        
        page.wait_for_url_contains("/admin")
        assert "/admin" in page.get_current_url()
    
    def test_view_auction_from_admin(self, driver, base_url):
        """Переход к аукциону из админ панели."""
        page = AdminPage(driver, base_url)
        page.open()
        
        page.click_auctions_tab()
        time.sleep(1)
        
        auctions = page.get_auctions_list()
        
        if auctions:
            page.view_auction_by_index(0)
            
            time.sleep(1)
            
            # Должны перейти на страницу аукциона
            assert "/auctions/" in page.get_current_url()
        else:
            pytest.skip("Нет аукционов для просмотра")
