# Selenium Тесты для CryptoAuction Platform

Набор автоматизированных UI тестов для проверки всех сценариев использования приложения.

## Автоматическая подготовка окружения

Тесты автоматически проверяют и при необходимости:
- ✅ **Запускают бэкенд** (`npm run dev` в корне проекта)
- ✅ **Запускают фронтенд** (`npm run dev` в папке frontend)
- ✅ **Создают тестовых пользователей** (testuser и admin)

Это означает, что вам достаточно просто запустить тесты - всё остальное произойдёт автоматически!

## Структура проекта

```
tests/selenium/
├── conftest.py           # Конфигурация pytest и fixtures
├── pytest.ini            # Настройки pytest
├── requirements.txt      # Зависимости Python
├── .env.example          # Пример файла окружения
├── pages/                # Page Object Models
│   ├── __init__.py
│   ├── base_page.py      # Базовый класс страницы
│   ├── home_page.py      # Главная страница
│   ├── login_page.py     # Страница входа
│   ├── register_page.py  # Страница регистрации
│   ├── auctions_page.py  # Список аукционов
│   ├── auction_detail_page.py  # Детали аукциона
│   ├── profile_page.py   # Профиль пользователя
│   └── admin_page.py     # Админ панель
├── tests/                # Тестовые файлы
│   ├── __init__.py
│   ├── test_auth.py      # Тесты авторизации
│   ├── test_home.py      # Тесты главной страницы
│   ├── test_auctions.py  # Тесты аукционов
│   ├── test_profile.py   # Тесты профиля
│   └── test_admin.py     # Тесты админки
└── utils/                # Вспомогательные функции
    ├── __init__.py
    └── helpers.py
```

## Установка

### 1. Создание виртуального окружения

```bash
cd tests/selenium
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate
```

### 2. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 3. Настройка окружения

Скопируйте файл `.env.example` в `.env` и настройте переменные:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
BASE_URL=http://localhost:5173
TEST_USERNAME=testuser
TEST_PASSWORD=testpass123
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## Запуск тестов

### Быстрый старт (рекомендуется)

```bash
# Запустит бэкенд, фронтенд, создаст пользователей и выполнит тесты
python run_tests.py
```

### Через скрипт run_tests.py

```bash
# Все тесты
python run_tests.py

# Smoke тесты (быстрые)
python run_tests.py --smoke

# Regression тесты
python run_tests.py --regression

# В headless режиме
python run_tests.py --headless

# С HTML отчётом
python run_tests.py --html report.html

# Конкретные тесты
python run_tests.py -k "test_login"

# Без автозапуска сервисов (если уже запущены)
python run_tests.py --no-auto-setup
```

### Через pytest напрямую

```bash
# Все тесты с автозапуском
pytest

# С подробным выводом
pytest -v

# Конкретный файл
pytest tests/test_auth.py

# Конкретный тест
pytest tests/test_auth.py::TestLogin::test_login_success
```

### По маркерам

```bash
# Только smoke тесты
pytest -m smoke

# Только тесты авторизации
pytest -m auth

# Только тесты аукционов
pytest -m auctions
```

### Опции автозапуска

```bash
# Отключить всю автоматическую настройку
pytest --no-auto-setup

# Не запускать бэкенд (если уже работает)
pytest --no-auto-backend

# Не запускать фронтенд (если уже работает)
pytest --no-auto-frontend

# Не создавать пользователей (если уже есть)
pytest --no-auto-users
```

### С разными браузерами

```bash
# Chrome (по умолчанию)
pytest --browser=chrome

# Firefox
pytest --browser=firefox

# Edge
pytest --browser=edge
```

### Headless режим

```bash
pytest --headless
```

### С другим URL

```bash
pytest --base-url=http://example.com --api-url=http://api.example.com
```

### Параллельный запуск

```bash
# Запуск на 4 процессах
pytest -n 4

# Авто-определение количества процессов
pytest -n auto
```

### Генерация HTML отчёта

```bash
pytest --html=report.html --self-contained-html
```

### Генерация Allure отчёта

```bash
# Запуск тестов
pytest --alluredir=allure-results

# Генерация отчёта
allure serve allure-results
```

## Сценарии тестирования

### Авторизация (test_auth.py)

- ✅ Загрузка страницы регистрации
- ✅ Проверка элементов страницы регистрации
- ✅ Успешная регистрация нового пользователя
- ✅ Регистрация с коротким именем (валидация)
- ✅ Регистрация с коротким паролем (валидация)
- ✅ Регистрация с существующим именем
- ✅ Переключение видимости пароля
- ✅ Загрузка страницы входа
- ✅ Успешный вход в систему
- ✅ Вход с неправильным паролем
- ✅ Вход несуществующего пользователя
- ✅ Выход из системы
- ✅ Защита маршрутов от неавторизованного доступа

### Главная страница (test_home.py)

- ✅ Загрузка главной страницы
- ✅ Hero секция с заголовком и описанием
- ✅ Секция features (4 карточки)
- ✅ Секция статистики
- ✅ Кнопки для неавторизованных
- ✅ Кнопки для авторизованных
- ✅ Навигация по логотипу

### Аукционы (test_auctions.py)

- ✅ Загрузка списка аукционов
- ✅ Элементы страницы аукционов
- ✅ Карточки аукционов с информацией
- ✅ Статусы аукционов (Активен, Запланирован, и т.д.)
- ✅ Переход на детальную страницу аукциона
- ✅ Информация об аукционе (заголовок, описание, статус)
- ✅ Статистика аукциона (раунд, лоты)
- ✅ Форма ставки для активных аукционов
- ✅ Валидация минимальной ставки
- ✅ Размещение ставки
- ✅ Секция топ ставок

### Профиль (test_profile.py)

- ✅ Загрузка страницы профиля
- ✅ Карточки баланса (TON, USDT)
- ✅ Отображение доступного и заблокированного баланса
- ✅ Форма создания депозита
- ✅ Выбор валюты депозита
- ✅ Создание депозита
- ✅ Форма вывода средств
- ✅ Валидация полей вывода
- ✅ История транзакций
- ✅ Типы и статусы транзакций

### Админ панель (test_admin.py)

- ✅ Доступ только для администраторов
- ✅ Загрузка админ панели
- ✅ Переключение между табами
- ✅ Статистика (пользователи, аукционы, ставки)
- ✅ Список аукционов
- ✅ Обновление списка аукционов
- ✅ Форма создания аукциона
- ✅ Валидация формы создания
- ✅ Успешное создание аукциона
- ✅ Просмотр транзакций
- ✅ Просмотр событий системы

## Предварительные требования

1. **Python 3.9+** установлен
2. **Chrome/Firefox/Edge** браузер установлен
3. **Node.js и npm** установлены (для запуска бэкенда и фронтенда)
4. **MongoDB** запущена (требуется для бэкенда)
5. **Redis** запущена (требуется для бэкенда)

## Автоматическая подготовка (по умолчанию)

При запуске тестов автоматически:

1. ✅ **Проверяется бэкенд** - если не запущен, запускается автоматически
2. ✅ **Проверяется фронтенд** - если не запущен, запускается автоматически
3. ✅ **Создаются тестовые пользователи**:
   - Обычный пользователь: `testuser` / `testpass123`
   - Администратор: `admin` / `admin123`

После завершения тестов запущенные сервисы автоматически останавливаются.

## Ручная подготовка (если нужно)

Если хотите запустить сервисы вручную:

```bash
# Терминал 1: Бэкенд
cd /path/to/telegram-auc
npm run dev

# Терминал 2: Фронтенд
cd /path/to/telegram-auc/frontend
npm run dev

# Терминал 3: Тесты без автозапуска
cd /path/to/telegram-auc/tests/selenium
pytest --no-auto-setup
```

## Советы по отладке

### Скриншоты при падении

При падении теста автоматически создаётся скриншот в папке `screenshots/`.

### Запуск в не-headless режиме

Для визуальной отладки запускайте без `--headless`:

```bash
pytest tests/test_auth.py -v
```

### Увеличение таймаутов

Если тесты падают из-за таймаутов, увеличьте их:

```bash
pytest --timeout=600
```

### Отладка конкретного теста

```bash
pytest tests/test_auth.py::TestLogin::test_login_success -v --capture=no
```

## CI/CD интеграция

### GitHub Actions пример

```yaml
name: Selenium Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd tests/selenium
        pip install -r requirements.txt
    
    - name: Run tests
      run: |
        cd tests/selenium
        pytest --headless --html=report.html --self-contained-html
      env:
        BASE_URL: ${{ secrets.BASE_URL }}
        TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
        TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
    
    - name: Upload report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-report
        path: tests/selenium/report.html
```

## Расширение тестов

### Добавление нового Page Object

1. Создайте файл в `pages/`:

```python
from pages.base_page import BasePage
from selenium.webdriver.common.by import By

class NewPage(BasePage):
    # Локаторы
    ELEMENT = (By.CSS_SELECTOR, ".element")
    
    def __init__(self, driver, base_url):
        super().__init__(driver, base_url)
        self.path = "/new-page"
    
    def open(self):
        super().open(self.path)
        return self
```

2. Добавьте экспорт в `pages/__init__.py`

### Добавление нового теста

1. Создайте файл в `tests/`:

```python
import pytest
from pages.new_page import NewPage

class TestNewPage:
    def test_page_loads(self, driver, base_url):
        page = NewPage(driver, base_url)
        page.open()
        assert page.is_element_visible(page.ELEMENT)
```

## Контакты

При возникновении вопросов создайте Issue в репозитории.
