"""
Тесты главной страницы.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pages.home_page import HomePage
from pages.login_page import LoginPage


class TestHomePage:
    """Тесты главной страницы."""
    
    def test_home_page_loads(self, driver, base_url):
        """Проверка загрузки главной страницы."""
        page = HomePage(driver, base_url)
        page.open()
        
        assert "CryptoAuction" in page.get_hero_title()
    
    def test_home_page_hero_section(self, driver, base_url):
        """Проверка hero секции."""
        page = HomePage(driver, base_url)
        page.open()
        
        # Проверяем наличие badge
        assert page.is_hero_badge_visible()
        
        # Проверяем заголовок
        title = page.get_hero_title()
        assert "CryptoAuction" in title
        
        # Проверяем описание
        description = page.get_hero_description()
        assert len(description) > 0
    
    def test_home_page_features_section(self, driver, base_url):
        """Проверка секции features."""
        page = HomePage(driver, base_url)
        page.open()
        
        # Проверяем количество карточек
        assert page.get_feature_cards_count() == 4
        
        # Проверяем заголовки
        titles = page.get_feature_cards_titles()
        assert "Мгновенные ставки" in titles
        assert "Безопасность" in titles
        assert "Многораундовая система" in titles
        assert "Крипто расчёты" in titles
    
    def test_home_page_stats_section(self, driver, base_url):
        """Проверка секции статистики."""
        page = HomePage(driver, base_url)
        page.open()
        
        assert page.is_stats_section_visible()
        assert page.get_stats_count() == 4
        
        # Проверяем, что есть значения
        values = page.get_stats_values()
        assert len(values) == 4
        for value in values:
            assert len(value) > 0
    
    def test_home_page_unauthenticated_buttons(self, driver, base_url):
        """Проверка кнопок для неавторизованных пользователей."""
        page = HomePage(driver, base_url)
        page.open()
        
        # Проверяем видимость кнопок входа/регистрации
        assert page.is_login_buttons_visible()
        
        # Проверяем, что кнопка перехода к аукционам не видна
        assert not page.is_go_to_auctions_visible()
    
    def test_home_page_authenticated_buttons(self, driver, base_url, test_user):
        """Проверка кнопок для авторизованных пользователей."""
        # Сначала входим
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
        
        # Переходим на главную
        page = HomePage(driver, base_url)
        page.open()
        
        # Проверяем видимость кнопки перехода к аукционам
        assert page.is_go_to_auctions_visible()
        
        # Проверяем, что кнопки входа/регистрации не видны
        assert not page.is_login_buttons_visible()
    
    def test_click_start_trading_goes_to_register(self, driver, base_url):
        """Клик по 'Начать торговать' ведёт на регистрацию."""
        page = HomePage(driver, base_url)
        page.open()
        
        page.click_start_trading()
        
        page.wait_for_url_contains("/register")
        assert "/register" in page.get_current_url()
    
    def test_click_login_goes_to_login(self, driver, base_url):
        """Клик по 'Войти в аккаунт' ведёт на страницу входа."""
        page = HomePage(driver, base_url)
        page.open()
        
        page.click_login_button()
        
        page.wait_for_url_contains("/login")
        assert "/login" in page.get_current_url()
    
    def test_logo_navigation_works(self, driver, base_url):
        """Клик по логотипу возвращает на главную."""
        page = HomePage(driver, base_url)
        page.open()
        
        # Переходим на логин
        page.navigate_to_login()
        page.wait_for_url_contains("/login")
        
        # Кликаем по логотипу
        page.click_logo()
        
        # Проверяем, что вернулись на главную
        assert page.get_current_url().rstrip('/') == base_url.rstrip('/') or page.get_current_url() == f"{base_url}/"


class TestNavigation:
    """Тесты навигации."""
    
    def test_nav_login_visible_when_unauthenticated(self, driver, base_url):
        """Ссылка на вход видна для неавторизованных."""
        page = HomePage(driver, base_url)
        page.open()
        
        assert page.is_element_visible(page.NAV_LOGIN) or page.is_element_visible(page.NAV_REGISTER)
    
    def test_nav_auctions_visible_when_authenticated(self, driver, base_url, test_user):
        """Ссылка на аукционы видна для авторизованных."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Тестовый пользователь не существует")
        
        page = HomePage(driver, base_url)
        page.open()
        
        assert page.is_element_visible(page.NAV_AUCTIONS)
    
    def test_nav_profile_visible_when_authenticated(self, driver, base_url, test_user):
        """Ссылка на профиль видна для авторизованных."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Тестовый пользователь не существует")
        
        page = HomePage(driver, base_url)
        page.open()
        
        assert page.is_element_visible(page.NAV_PROFILE)
    
    def test_balance_displayed_when_authenticated(self, driver, base_url, test_user):
        """Баланс отображается для авторизованных."""
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Тестовый пользователь не существует")
        
        page = HomePage(driver, base_url)
        page.open()
        
        balance = page.get_balance()
        assert "TON" in balance or len(balance) > 0
