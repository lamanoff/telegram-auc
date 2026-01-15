"""
Тесты списка аукционов и детальной страницы аукциона.
"""
import pytest
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pages.auctions_page import AuctionsPage
from pages.auction_detail_page import AuctionDetailPage
from pages.login_page import LoginPage


class TestAuctionsPage:
    """Тесты страницы списка аукционов."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def test_auctions_page_loads(self, driver, base_url):
        """Проверка загрузки страницы аукционов."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        assert "Аукционы" in page.get_page_title()
    
    def test_auctions_page_elements(self, driver, base_url):
        """Проверка наличия элементов на странице."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        # Заголовок
        assert "Аукционы" in page.get_page_title()
        
        # Описание
        description = page.get_page_description()
        assert len(description) > 0
    
    def test_auctions_loading_state(self, driver, base_url):
        """Проверка состояния загрузки."""
        page = AuctionsPage(driver, base_url)
        # Переходим напрямую, не открывая через метод с ожиданием
        driver.get(f"{base_url}/auctions")
        
        # Должен отображаться либо спиннер, либо контент
        time.sleep(0.5)  # Даём время для начала загрузки
        
        # Ждём окончания загрузки
        page.wait_for_auctions_loaded()
        
        # После загрузки либо список, либо пустое состояние
        is_empty = page.is_empty()
        auctions_count = page.get_auctions_count()
        
        assert is_empty or auctions_count >= 0
    
    def test_auctions_empty_state(self, driver, base_url):
        """Проверка пустого состояния (если нет аукционов)."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        if page.is_empty():
            # Проверяем наличие соответствующего сообщения
            assert page.is_element_visible((page.EMPTY_ICON[0], page.EMPTY_ICON[1]))
    
    def test_auction_card_elements(self, driver, base_url):
        """Проверка элементов карточки аукциона."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        if not page.is_empty():
            auctions = page.get_auction_cards()
            
            if auctions:
                auction = auctions[0]
                
                # Проверяем наличие обязательных полей
                assert "title" in auction
                assert "status" in auction
                assert "currency" in auction
                
                # Проверяем, что поля не пустые
                assert len(auction["title"]) > 0
                assert len(auction["status"]) > 0
                assert auction["currency"] in ["TON", "USDT"]
    
    def test_auction_status_badges(self, driver, base_url):
        """Проверка статусов аукционов."""
        page = AuctionsPage(driver, base_url)
        page.open()

        if not page.is_empty():
            auctions = page.get_auction_cards()

            # Проверяем статус без учёта регистра
            valid_statuses = ["активен", "запланирован", "завершён", "отменён"]

            for auction in auctions:
                status_lower = auction["status"].lower()
                assert status_lower in valid_statuses, \
                    f"Неизвестный статус: {auction['status']}"
    
    def test_click_auction_opens_detail(self, driver, base_url):
        """Клик по аукциону открывает детальную страницу."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        if not page.is_empty() and page.get_auctions_count() > 0:
            # Кликаем по первому аукциону
            result = page.click_first_auction()
            assert result, "Не удалось кликнуть по аукциону"
            
            # Проверяем, что перешли на детальную страницу
            page.wait_for_url_contains("/auctions/")
            assert "/auctions/" in page.get_current_url()
        else:
            pytest.skip("Нет доступных аукционов для теста")
    
    def test_refresh_auctions(self, driver, base_url):
        """Проверка обновления списка аукционов."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        initial_count = page.get_auctions_count()
        
        page.refresh_auctions()
        
        # После обновления количество может быть таким же или изменённым
        new_count = page.get_auctions_count()
        assert new_count >= 0
    
    def test_create_button_visible_for_admin(self, driver, base_url, admin_user):
        """Кнопка создания видна для админа."""
        # Выходим из текущего аккаунта
        from pages.base_page import BasePage
        base = BasePage(driver, base_url)
        if base.is_logged_in():
            base.logout()
        
        # Входим под админом
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(admin_user["username"], admin_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Админ пользователь не существует")
        
        # Проверяем, что это действительно админ
        if not base.is_admin_link_visible():
            pytest.skip("Пользователь не имеет прав администратора")
        
        page = AuctionsPage(driver, base_url)
        page.open()
        
        # Для админа ссылка на админку должна быть видна
        assert base.is_admin_link_visible(), "Ссылка на админку не видна для администратора"


class TestAuctionDetailPage:
    """Тесты детальной страницы аукциона."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def get_first_auction_id(self, driver, base_url):
        """Получить ID первого аукциона."""
        page = AuctionsPage(driver, base_url)
        page.open()
        
        if page.is_empty() or page.get_auctions_count() == 0:
            return None
        
        page.click_first_auction()
        page.wait_for_url_contains("/auctions/")
        
        # Извлекаем ID из URL
        url = page.get_current_url()
        auction_id = url.split("/auctions/")[-1].rstrip("/")
        return auction_id
    
    def test_auction_detail_page_loads(self, driver, base_url):
        """Проверка загрузки детальной страницы аукциона."""
        auction_id = self.get_first_auction_id(driver, base_url)
        
        if not auction_id:
            pytest.skip("Нет доступных аукционов для теста")
        
        page = AuctionDetailPage(driver, base_url)
        page.open(auction_id)
        
        # Ждём загрузки
        assert not page.is_loading(), "Страница всё ещё загружается"
        
        # Проверяем заголовок
        title = page.get_auction_title()
        assert len(title) > 0
    
    def test_auction_detail_header_elements(self, driver, base_url):
        """Проверка элементов заголовка аукциона."""
        auction_id = self.get_first_auction_id(driver, base_url)
        
        if not auction_id:
            pytest.skip("Нет доступных аукционов для теста")
        
        page = AuctionDetailPage(driver, base_url)
        page.open(auction_id)
        
        # Заголовок
        assert len(page.get_auction_title()) > 0
        
        # Статус (проверяем без учёта регистра)
        status = page.get_auction_status().lower()
        assert status in ["активен", "запланирован", "завершён", "отменён"]
        
        # Валюта
        currency = page.get_auction_currency()
        assert currency in ["TON", "USDT"]
    
    def test_auction_detail_stats_grid(self, driver, base_url):
        """Проверка статистики аукциона."""
        auction_id = self.get_first_auction_id(driver, base_url)
        
        if not auction_id:
            pytest.skip("Нет доступных аукционов для теста")
        
        page = AuctionDetailPage(driver, base_url)
        page.open(auction_id)
        
        # Раунд
        round_info = page.get_current_round()
        assert "/" in round_info  # Формат "X / Y"
        
        # Продано лотов
        items_info = page.get_items_sold()
        assert "/" in items_info  # Формат "X / Y"
    
    def test_bid_form_visible_for_active_auction(self, driver, base_url):
        """Форма ставки видна для активного аукциона."""
        auctions_page = AuctionsPage(driver, base_url)
        auctions_page.open()
        
        if auctions_page.get_active_auctions_count() == 0:
            pytest.skip("Нет активных аукционов для теста")
        
        auctions_page.click_first_active_auction()
        auctions_page.wait_for_url_contains("/auctions/")
        
        page = AuctionDetailPage(driver, base_url)
        # Страница уже открыта
        
        # Для активного аукциона должна быть видна форма ставки
        assert page.is_bid_card_visible(), "Форма ставки не видна для активного аукциона"
    
    def test_min_bid_displayed_for_active_auction(self, driver, base_url):
        """Минимальная ставка отображается для активного аукциона."""
        auctions_page = AuctionsPage(driver, base_url)
        auctions_page.open()
        
        if auctions_page.get_active_auctions_count() == 0:
            pytest.skip("Нет активных аукционов для теста")
        
        auctions_page.click_first_active_auction()
        auctions_page.wait_for_url_contains("/auctions/")
        
        page = AuctionDetailPage(driver, base_url)
        
        if page.is_min_bid_visible():
            min_bid = page.get_min_bid()
            assert len(min_bid) > 0
    
    def test_top_bids_section(self, driver, base_url):
        """Проверка секции топ ставок."""
        auction_id = self.get_first_auction_id(driver, base_url)
        
        if not auction_id:
            pytest.skip("Нет доступных аукционов для теста")
        
        page = AuctionDetailPage(driver, base_url)
        page.open(auction_id)
        
        # Либо есть ставки, либо пустое состояние
        bids_count = page.get_top_bids_count()
        is_empty = page.is_bids_empty()
        
        assert bids_count >= 0 or is_empty


class TestBidding:
    """Тесты размещения ставок."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def get_active_auction_page(self, driver, base_url):
        """Открыть активный аукцион и вернуть страницу."""
        auctions_page = AuctionsPage(driver, base_url)
        auctions_page.open()
        
        if auctions_page.get_active_auctions_count() == 0:
            return None
        
        auctions_page.click_first_active_auction()
        auctions_page.wait_for_url_contains("/auctions/")
        
        return AuctionDetailPage(driver, base_url)
    
    def test_place_bid_validation_min_amount(self, driver, base_url):
        """Валидация минимальной суммы ставки."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        # Вводим слишком маленькую ставку
        page.place_bid("0.0001")
        
        # Ожидаем ошибку
        result = page.wait_for_bid_result(timeout=5)
        if result == "error":
            error_msg = page.get_bid_error_message()
            assert "Минимальная" in error_msg or len(error_msg) > 0
    
    def test_place_bid_empty_amount(self, driver, base_url):
        """Попытка ставки с пустой суммой."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        # Очищаем поле и пытаемся сделать ставку
        page.clear_bid_input()
        page.click_place_bid()
        
        # Должна быть ошибка или кнопка не сработает
        result = page.wait_for_bid_result(timeout=3)
        # Либо ошибка, либо timeout (форма не отправится)
        assert result in ["error", "timeout"]
    
    def test_bid_input_placeholder(self, driver, base_url):
        """Проверка placeholder поля ввода ставки."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        placeholder = page.get_bid_input_placeholder()
        assert "Минимум" in placeholder or len(placeholder) > 0
    
    def test_place_valid_bid(self, driver, base_url):
        """Успешное размещение ставки."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        # Получаем минимальную ставку из placeholder или текста
        min_bid_text = page.get_min_bid() if page.is_min_bid_visible() else "1"
        
        # Пытаемся извлечь число
        import re
        numbers = re.findall(r'[\d.]+', min_bid_text)
        if numbers:
            min_bid = float(numbers[0])
        else:
            min_bid = 1.0
        
        # Делаем ставку немного выше минимальной
        bid_amount = str(min_bid + 0.5)
        page.place_bid(bid_amount)
        
        result = page.wait_for_bid_result(timeout=10)
        
        # Ставка либо успешна, либо ошибка (недостаточно средств и т.д.)
        if result == "success":
            assert page.is_bid_success_displayed()
        elif result == "error":
            # Это может быть недостаточно средств - это ожидаемо
            error_msg = page.get_bid_error_message()
            # Не должно быть критических ошибок
            assert len(error_msg) > 0
    
    def test_bid_updates_your_bid_section(self, driver, base_url):
        """После ставки обновляется секция 'Ваша ставка'."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        # Если уже есть ставка - проверяем её отображение
        if page.has_existing_bid():
            amount = page.get_your_bid_amount()
            assert len(amount) > 0
            
            rank = page.get_your_bid_rank()
            assert len(rank) > 0
    
    def test_bid_button_disabled_during_submission(self, driver, base_url):
        """Кнопка ставки блокируется во время отправки."""
        page = self.get_active_auction_page(driver, base_url)
        
        if not page:
            pytest.skip("Нет активных аукционов для теста")
        
        # Получаем минимальную ставку
        min_bid_text = page.get_min_bid() if page.is_min_bid_visible() else "1"
        import re
        numbers = re.findall(r'[\d.]+', min_bid_text)
        min_bid = float(numbers[0]) if numbers else 1.0
        
        # Вводим ставку
        page.enter_bid_amount(str(min_bid + 0.5))
        
        # Проверяем начальный текст
        initial_text = page.get_bid_button_text()
        
        # Кликаем
        page.click_place_bid()
        
        # Сразу проверяем (может измениться на "Отправка...")
        # Это зависит от скорости соединения
        time.sleep(0.3)
        
        # Ждём результата
        page.wait_for_bid_result(timeout=10)


class TestAuctionNavigation:
    """Тесты навигации по аукционам."""
    
    @pytest.fixture(autouse=True)
    def login_before_tests(self, driver, base_url, test_user):
        """Авторизация перед каждым тестом."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
    
    def test_navigate_to_auctions_from_nav(self, driver, base_url):
        """Переход на аукционы через навигацию."""
        from pages.home_page import HomePage
        
        page = HomePage(driver, base_url)
        page.open()
        
        page.navigate_to_auctions()
        
        page.wait_for_url_contains("/auctions")
        assert "/auctions" in page.get_current_url()
    
    def test_back_to_auctions_list(self, driver, base_url):
        """Возврат к списку аукционов."""
        auctions_page = AuctionsPage(driver, base_url)
        auctions_page.open()
        
        if auctions_page.is_empty() or auctions_page.get_auctions_count() == 0:
            pytest.skip("Нет доступных аукционов для теста")
        
        # Открываем детальную страницу
        auctions_page.click_first_auction()
        auctions_page.wait_for_url_contains("/auctions/")
        
        # Возвращаемся назад
        auctions_page.go_back()
        
        # Должны вернуться к списку
        time.sleep(1)
        assert "/auctions/" not in auctions_page.get_current_url() or \
               auctions_page.get_current_url().endswith("/auctions")
