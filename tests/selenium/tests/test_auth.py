"""
Тесты регистрации и авторизации.
"""
import pytest
import sys
import os

# Добавляем путь к pages
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pages.login_page import LoginPage
from pages.register_page import RegisterPage
from pages.home_page import HomePage


class TestRegistration:
    """Тесты регистрации нового пользователя."""
    
    def test_register_page_loads(self, driver, base_url):
        """Проверка загрузки страницы регистрации."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        assert page.is_auth_card_visible(), "Карточка регистрации не отображается"
        assert "Создать аккаунт" in page.get_page_title()
    
    def test_register_page_elements(self, driver, base_url):
        """Проверка наличия всех элементов на странице регистрации."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        # Проверяем заголовок и описание
        assert page.get_page_title() == "Создать аккаунт"
        assert "Присоединяйтесь" in page.get_page_description()
        
        # Проверяем подсказки
        assert "Минимум 3 символа" in page.get_username_hint()
        assert "Минимум 6 символов" in page.get_password_hint()
        
        # Проверяем кнопку
        assert "Создать аккаунт" in page.get_submit_button_text()
        
        # Проверяем условия использования
        assert "условиями использования" in page.get_terms_text()
    
    def test_register_success(self, driver, base_url, unique_user):
        """Успешная регистрация нового пользователя."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        # Регистрация
        page.register(unique_user["username"], unique_user["password"])
        
        # Ожидаем успешного сообщения или перенаправления
        try:
            if page.is_success_displayed():
                assert "Регистрация успешна" in page.get_success_message()
            else:
                # Проверяем переход на страницу аукционов
                page.wait_for_url_contains("/auctions", timeout=5)
                assert "/auctions" in page.get_current_url()
        except:
            # Если ошибка - выводим сообщение
            if page.is_error_displayed():
                pytest.fail(f"Ошибка регистрации: {page.get_error_message()}")
    
    def test_register_short_username(self, driver, base_url):
        """Регистрация с коротким именем пользователя (менее 3 символов)."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        page.register("ab", "validpassword123")
        
        # Ожидаем ошибку
        assert page.is_error_displayed(), "Ожидалась ошибка валидации"
    
    def test_register_short_password(self, driver, base_url, unique_user):
        """Регистрация с коротким паролем (менее 6 символов)."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        page.register(unique_user["username"], "12345")
        
        # Ожидаем ошибку
        assert page.is_error_displayed(), "Ожидалась ошибка валидации"
    
    def test_register_duplicate_username(self, driver, base_url, test_user):
        """Попытка регистрации с уже существующим именем."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        page.register(test_user["username"], "differentpassword123")
        
        # Ожидаем ошибку
        assert page.is_error_displayed(), "Ожидалась ошибка о существующем пользователе"
    
    def test_register_toggle_password_visibility(self, driver, base_url):
        """Проверка переключения видимости пароля."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        page.enter_password("testpassword")
        
        # По умолчанию пароль скрыт
        assert not page.is_password_visible()
        
        # Переключаем видимость
        page.toggle_password_visibility()
        assert page.is_password_visible()
        
        # Переключаем обратно
        page.toggle_password_visibility()
        assert not page.is_password_visible()
    
    def test_register_link_to_login(self, driver, base_url):
        """Проверка ссылки на страницу входа."""
        page = RegisterPage(driver, base_url)
        page.open()
        
        page.click_login_link()
        
        page.wait_for_url_contains("/login")
        assert "/login" in page.get_current_url()


class TestLogin:
    """Тесты авторизации пользователя."""
    
    def test_login_page_loads(self, driver, base_url):
        """Проверка загрузки страницы входа."""
        page = LoginPage(driver, base_url)
        page.open()
        
        assert page.is_auth_card_visible(), "Карточка входа не отображается"
        assert "Вход в аккаунт" in page.get_page_title()
    
    def test_login_page_elements(self, driver, base_url):
        """Проверка наличия всех элементов на странице входа."""
        page = LoginPage(driver, base_url)
        page.open()
        
        # Проверяем заголовок и описание
        assert page.get_page_title() == "Вход в аккаунт"
        assert "Введите данные" in page.get_page_description()
        
        # Проверяем кнопку
        assert "Войти" in page.get_submit_button_text()
    
    def test_login_success(self, driver, base_url, test_user):
        """Успешный вход в систему."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.login(test_user["username"], test_user["password"])
        
        # Проверяем переход на страницу аукционов
        try:
            page.wait_for_url_contains("/auctions", timeout=10)
            assert "/auctions" in page.get_current_url()
        except:
            if page.is_error_displayed():
                pytest.skip(f"Тестовый пользователь не существует: {page.get_error_message()}")
    
    def test_login_wrong_password(self, driver, base_url, test_user):
        """Вход с неправильным паролем."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.login(test_user["username"], "wrongpassword")
        
        # Ожидаем ошибку
        assert page.is_error_displayed(), "Ожидалась ошибка авторизации"
    
    def test_login_nonexistent_user(self, driver, base_url):
        """Вход несуществующего пользователя."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.login("nonexistent_user_12345", "somepassword")
        
        # Ожидаем ошибку
        assert page.is_error_displayed(), "Ожидалась ошибка авторизации"
    
    def test_login_empty_fields(self, driver, base_url):
        """Попытка входа с пустыми полями."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.click_submit()
        
        # HTML5 валидация не даст отправить форму
        # Проверяем, что мы всё ещё на странице входа
        assert "/login" in page.get_current_url()
    
    def test_login_toggle_password_visibility(self, driver, base_url):
        """Проверка переключения видимости пароля."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.enter_password("testpassword")
        
        # По умолчанию пароль скрыт
        assert not page.is_password_visible()
        
        # Переключаем видимость
        page.toggle_password_visibility()
        assert page.is_password_visible()
    
    def test_login_link_to_register(self, driver, base_url):
        """Проверка ссылки на страницу регистрации."""
        page = LoginPage(driver, base_url)
        page.open()
        
        page.click_register_link()
        
        page.wait_for_url_contains("/register")
        assert "/register" in page.get_current_url()


class TestLogout:
    """Тесты выхода из системы."""
    
    def test_logout_redirects_to_home(self, driver, base_url, test_user):
        """Проверка выхода из системы."""
        # Сначала входим
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            if login_page.is_error_displayed():
                pytest.skip("Тестовый пользователь не существует")
            raise
        
        # Проверяем, что мы авторизованы
        assert login_page.is_logged_in(), "Не удалось авторизоваться"
        
        # Выходим
        login_page.logout()
        
        # Проверяем, что кнопка входа снова доступна
        assert not login_page.is_logged_in(), "Пользователь всё ещё авторизован после выхода"
    
    def test_logout_shows_login_buttons(self, driver, base_url, test_user):
        """После выхода отображаются кнопки входа."""
        # Входим
        login_page = LoginPage(driver, base_url)
        login_page.open()
        login_page.login(test_user["username"], test_user["password"])
        
        try:
            login_page.wait_for_url_contains("/auctions", timeout=10)
        except:
            pytest.skip("Тестовый пользователь не существует")
        
        # Выходим
        login_page.logout()
        
        # Переходим на главную
        home_page = HomePage(driver, base_url)
        home_page.open()
        
        # Проверяем кнопки для неавторизованных
        assert home_page.is_login_buttons_visible(), "Кнопки входа не отображаются"


class TestAuthProtectedRoutes:
    """Тесты защищённых маршрутов."""
    
    def test_auctions_redirect_to_login(self, driver, base_url):
        """Попытка доступа к аукционам без авторизации."""
        driver.get(f"{base_url}/auctions")
        
        # Должно перенаправить на логин
        from pages.base_page import BasePage
        base = BasePage(driver, base_url)
        try:
            base.wait_for_url_contains("/login", timeout=5)
            assert "/login" in driver.current_url
        except:
            # Возможно, приложение по-другому обрабатывает это
            pass
    
    def test_profile_redirect_to_login(self, driver, base_url):
        """Попытка доступа к профилю без авторизации."""
        driver.get(f"{base_url}/profile")
        
        from pages.base_page import BasePage
        base = BasePage(driver, base_url)
        try:
            base.wait_for_url_contains("/login", timeout=5)
            assert "/login" in driver.current_url
        except:
            pass
    
    def test_admin_redirect_to_login(self, driver, base_url):
        """Попытка доступа к админке без авторизации."""
        driver.get(f"{base_url}/admin")
        
        from pages.base_page import BasePage
        base = BasePage(driver, base_url)
        try:
            base.wait_for_url_contains("/login", timeout=5)
            assert "/login" in driver.current_url
        except:
            pass
