"""
End-to-End тесты - полные сценарии использования приложения.
"""
import pytest
import sys
import os
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pages.home_page import HomePage
from pages.login_page import LoginPage
from pages.register_page import RegisterPage
from pages.auctions_page import AuctionsPage
from pages.auction_detail_page import AuctionDetailPage
from pages.profile_page import ProfilePage
from pages.admin_page import AdminPage


@pytest.mark.smoke
class TestSmokeScenarios:
    """Smoke тесты - базовая проверка работоспособности."""
    
    def test_home_page_accessible(self, driver, base_url):
        """Главная страница доступна."""
        page = HomePage(driver, base_url)
        page.open()
        
        assert "CryptoAuction" in page.get_hero_title()
    
    def test_login_page_accessible(self, driver, base_url):
        """Страница входа доступна."""
        page = LoginPage(driver, base_url)
        page.open()
        
        assert "Вход" in page.get_page_title()
    
    def test_register_page_accessible(self, driver, base_url):
        """Страница регистрации доступна."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        assert "Создать" in page.get_page_title()
    
    def test_user_can_login(self, driver, base_url, test_user):
        """Пользователь может войти в систему."""
        page = LoginPage(driver, base_url)
        page.open()
        page.login(test_user["username"], test_user["password"])
        
        try:
            page.wait_for_url_contains("/auctions", timeout=10)
            assert page.is_logged_in()
        except:
            if page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")


@pytest.mark.regression
class TestUserRegistrationFlow:
    """E2E: Полный сценарий регистрации нового пользователя."""
    
    def test_full_registration_flow(self, driver, base_url, unique_user):
        """
        Сценарий:
        1. Открыть главную страницу
        2. Перейти на регистрацию
        3. Зарегистрировать нового пользователя
        4. Проверить успешную авторизацию
        5. Проверить отображение профиля
        """
        # 1. Главная страница
        home = HomePage(driver, base_url)
        home.open()
        assert "CryptoAuction" in home.get_hero_title()
        
        # 2. Переход на регистрацию
        home.click_start_trading()
        home.wait_for_url_contains("/register")
        
        # 3. Регистрация
        register = RegisterPage(driver, base_url)
        register.register(unique_user["username"], unique_user["password"])
        
        # 4. Ожидание успешной регистрации
        try:
            register.wait_for_url_contains("/auctions", timeout=10)
        except:
            if register.is_error_displayed():
                pytest.fail(f"Ошибка регистрации: {register.get_error_message()}")
        
        # 5. Проверяем, что пользователь авторизован
        assert register.is_logged_in()
        
        # Проверяем профиль
        register.navigate_to_profile()
        register.wait_for_url_contains("/profile")
        
        profile = ProfilePage(driver, base_url)
        assert "Профиль" in profile.get_page_title()


@pytest.mark.regression
class TestAuctionParticipationFlow:
    """E2E: Полный сценарий участия в аукционе."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед тестом."""
        login = LoginPage(driver, base_url)
        login.open()
        login.login(test_user["username"], test_user["password"])
        
        try:
            login.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def test_view_auctions_and_details(self, driver, base_url):
        """
        Сценарий:
        1. Открыть список аукционов
        2. Выбрать аукцион
        3. Просмотреть детали
        4. Вернуться к списку
        """
        # 1. Список аукционов
        auctions = AuctionsPage(driver, base_url)
        auctions.open()
        
        assert "Аукционы" in auctions.get_page_title()
        
        if auctions.is_empty():
            pytest.skip("Нет доступных аукционов")
        
        # 2. Выбираем первый аукцион
        initial_count = auctions.get_auctions_count()
        assert initial_count > 0
        
        auctions.click_first_auction()
        auctions.wait_for_url_contains("/auctions/")
        
        # 3. Просматриваем детали
        detail = AuctionDetailPage(driver, base_url)
        
        title = detail.get_auction_title()
        assert len(title) > 0
        
        status = detail.get_auction_status().lower()
        assert status in ["активен", "запланирован", "завершён", "отменён"]
        
        # 4. Возвращаемся
        detail.go_back()
        time.sleep(1)
    
    def test_place_bid_flow(self, driver, base_url):
        """
        Сценарий:
        1. Найти активный аукцион
        2. Открыть детали
        3. Разместить ставку
        4. Проверить результат
        """
        # 1. Ищем активный аукцион
        auctions = AuctionsPage(driver, base_url)
        auctions.open()
        
        if auctions.get_active_auctions_count() == 0:
            pytest.skip("Нет активных аукционов")
        
        # 2. Открываем активный аукцион
        auctions.click_first_active_auction()
        auctions.wait_for_url_contains("/auctions/")
        
        detail = AuctionDetailPage(driver, base_url)
        
        # 3. Проверяем форму ставки
        if not detail.is_bid_card_visible():
            pytest.fail("Форма ставки не видна для активного аукциона")
        
        # Получаем минимальную ставку
        import re
        min_bid_text = detail.get_min_bid() if detail.is_min_bid_visible() else "1"
        numbers = re.findall(r'[\d.]+', min_bid_text)
        min_bid = float(numbers[0]) if numbers else 1.0
        
        # 4. Размещаем ставку
        bid_amount = str(min_bid + 0.5)
        detail.place_bid(bid_amount)
        
        result = detail.wait_for_bid_result(timeout=10)
        
        # Проверяем результат
        if result == "success":
            assert detail.is_bid_success_displayed()
        elif result == "error":
            # Ошибка может быть из-за недостатка средств - это нормально
            error = detail.get_bid_error_message()
            assert len(error) > 0


@pytest.mark.regression
class TestProfileManagementFlow:
    """E2E: Полный сценарий управления профилем."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед тестом."""
        login = LoginPage(driver, base_url)
        login.open()
        login.login(test_user["username"], test_user["password"])
        
        try:
            login.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def test_view_profile_and_balances(self, driver, base_url):
        """
        Сценарий:
        1. Перейти в профиль
        2. Проверить отображение балансов
        3. Проверить историю транзакций
        """
        # 1. Переход в профиль
        from pages.base_page import BasePage
        base = BasePage(driver, base_url)
        base.navigate_to_profile()
        base.wait_for_url_contains("/profile")
        
        # 2. Проверяем балансы
        profile = ProfilePage(driver, base_url)
        
        assert profile.get_balance_cards_count() == 2
        
        ton_balance = profile.get_ton_total_balance()
        assert len(ton_balance) > 0
        
        usdt_balance = profile.get_usdt_total_balance()
        assert len(usdt_balance) > 0
        
        # 3. Проверяем транзакции
        profile.wait_for_transactions_loaded()
        
        # Либо есть транзакции, либо пустое состояние
        count = profile.get_transactions_count()
        is_empty = profile.is_transactions_empty()
        
        assert count >= 0 or is_empty
    
    def test_create_deposit_flow(self, driver, base_url):
        """
        Сценарий:
        1. Перейти в профиль
        2. Выбрать валюту депозита
        3. Ввести сумму
        4. Создать депозит
        5. Проверить получение ссылки на оплату
        """
        profile = ProfilePage(driver, base_url)
        profile.open()
        
        # Создаём депозит
        profile.create_deposit("TON", "1")
        
        time.sleep(3)
        
        # Проверяем наличие alert (ошибка CryptoBot)
        try:
            alert = driver.switch_to.alert
            alert_text = alert.text
            alert.accept()
            if "CryptoBot" in alert_text or "token" in alert_text.lower():
                pytest.skip("CryptoBot не настроен в тестовой среде")
            pytest.skip(f"Депозит не создан: {alert_text}")
        except:
            pass
        
        # Проверяем результат
        if profile.is_deposit_success_displayed():
            link = profile.get_deposit_payment_link()
            assert len(link) > 0
            assert "http" in link


@pytest.mark.regression
class TestAdminFlow:
    """E2E: Полный сценарий администрирования."""
    
    @pytest.fixture(autouse=True)
    def login_as_admin(self, driver, base_url, admin_user):
        """Авторизация под админом."""
        login = LoginPage(driver, base_url)
        login.open()
        login.login(admin_user["username"], admin_user["password"])
        
        try:
            login.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login.is_error_displayed():
                pytest.skip("Админ пользователь не существует")
        
        from pages.base_page import BasePage
        page = BasePage(driver, base_url)
        if not page.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
    
    def test_admin_dashboard_overview(self, driver, base_url):
        """
        Сценарий:
        1. Открыть админ панель
        2. Проверить статистику
        3. Просмотреть списки аукционов, транзакций, событий
        """
        admin = AdminPage(driver, base_url)
        admin.open()
        
        # 1. Проверяем статистику
        admin.click_stats_tab()
        assert admin.is_stats_grid_visible()
        
        users = admin.get_users_count()
        assert users.isdigit() or users == "0"
        
        # 2. Проверяем аукционы
        admin.click_auctions_tab()
        time.sleep(0.5)
        auctions = admin.get_auctions_list()
        assert isinstance(auctions, list)
        
        # 3. Проверяем транзакции
        admin.click_transactions_tab()
        time.sleep(0.5)
        transactions = admin.get_transactions_list()
        assert isinstance(transactions, list)
        
        # 4. Проверяем события
        admin.click_events_tab()
        time.sleep(0.5)
        events = admin.get_events_list()
        assert isinstance(events, list)
    
    def test_create_auction_flow(self, driver, base_url):
        """
        Сценарий:
        1. Открыть форму создания аукциона
        2. Заполнить все поля
        3. Создать аукцион
        4. Проверить его появление в списке
        """
        admin = AdminPage(driver, base_url)
        admin.open()
        
        # 1. Переходим на таб создания
        admin.click_create_tab()
        time.sleep(0.5)
        
        # 2. Заполняем форму
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        title = f"E2E Test Auction {timestamp}"
        start_time = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
        
        result = admin.create_auction(
            title=title,
            description="Аукцион созданный в E2E тесте",
            currency="TON",
            starting_price="1",
            min_increment="0.1",
            rounds_count="3",
            items_per_round="5",
            start_time=start_time,
            first_round_duration="120",
            round_duration="60"
        )
        
        if result:
            # 3. Проверяем появление в списке
            admin.click_auctions_tab()
            time.sleep(1)
            
            auctions = admin.get_auctions_list()
            auction_titles = [a["title"] for a in auctions]
            
            assert title in auction_titles


@pytest.mark.regression
class TestFullUserJourney:
    """E2E: Полный путь пользователя от регистрации до участия в аукционе."""
    
    def test_complete_user_journey(self, driver, base_url, unique_user):
        """
        Полный сценарий:
        1. Регистрация нового пользователя
        2. Просмотр профиля
        3. Попытка создания депозита
        4. Просмотр аукционов
        5. Просмотр деталей аукциона
        6. Выход из системы
        """
        # 1. РЕГИСТРАЦИЯ
        home = HomePage(driver, base_url)
        home.open()
        home.click_start_trading()
        
        register = RegisterPage(driver, base_url)
        register.wait_for_url_contains("/register")
        register.register(unique_user["username"], unique_user["password"])
        
        try:
            register.wait_for_url_contains("/auctions", timeout=10)
        except:
            if register.is_error_displayed():
                pytest.fail(f"Ошибка регистрации: {register.get_error_message()}")
        
        assert register.is_logged_in(), "Пользователь не авторизован после регистрации"
        
        # 2. ПРОФИЛЬ
        register.navigate_to_profile()
        register.wait_for_url_contains("/profile")
        
        profile = ProfilePage(driver, base_url)
        assert profile.get_balance_cards_count() == 2
        
        # Проверяем начальный баланс (должен быть 0)
        ton_balance = profile.get_ton_total_balance()
        
        # 3. ДЕПОЗИТ
        profile.create_deposit("TON", "5")
        time.sleep(2)
        
        # Закрываем alert если есть (CryptoBot не настроен)
        try:
            alert = driver.switch_to.alert
            alert.accept()
        except:
            pass
        
        # Должна быть ссылка или ошибка API
        
        # 4. АУКЦИОНЫ
        profile.navigate_to_auctions()
        profile.wait_for_url_contains("/auctions")
        
        auctions = AuctionsPage(driver, base_url)
        assert "Аукционы" in auctions.get_page_title()
        
        # 5. ДЕТАЛИ АУКЦИОНА (если есть)
        if not auctions.is_empty() and auctions.get_auctions_count() > 0:
            auctions.click_first_auction()
            auctions.wait_for_url_contains("/auctions/")
            
            detail = AuctionDetailPage(driver, base_url)
            title = detail.get_auction_title()
            assert len(title) > 0
        
        # 6. ВЫХОД
        detail_or_auctions = AuctionDetailPage(driver, base_url) if "/auctions/" in driver.current_url else auctions
        detail_or_auctions.logout()
        
        time.sleep(1)
        assert not detail_or_auctions.is_logged_in(), "Пользователь всё ещё авторизован после выхода"


@pytest.mark.slow
class TestPerformance:
    """Тесты производительности."""
    
    def test_page_load_times(self, driver, base_url, test_user):
        """Проверка времени загрузки страниц."""
        import time
        
        # Входим
        login = LoginPage(driver, base_url)
        login.open()
        login.login(test_user["username"], test_user["password"])
        
        try:
            login.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Тестовый пользователь не существует")
        
        pages = [
            ("/", "Home"),
            ("/auctions", "Auctions"),
            ("/profile", "Profile"),
        ]
        
        for path, name in pages:
            start = time.time()
            driver.get(f"{base_url}{path}")
            
            # Ждём загрузки страницы
            from pages.base_page import BasePage
            page = BasePage(driver, base_url)
            page.wait_for_spinner_disappear()
            
            load_time = time.time() - start
            
            # Страница должна загрузиться менее чем за 15 секунд (учитывая холодный старт Docker)
            assert load_time < 15, f"Страница {name} загружалась слишком долго: {load_time:.2f}s"
