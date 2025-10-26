import datetime

# Настройки базы данных PostgreSQL
DATABASE_CONFIG = {
    'dbname': 'sensor_data',
    'user': 'sensor_user', 
    'password': 'SANYA_XY3S0S',
    'host': 'localhost',
    'port': 5432
}

SENSOR_CONFIG = {
    'temperature': {
        'gen_min': 17.5, 'gen_max': 24.5,  # ДИАПАЗОН ГЕНЕРАЦИИ
        'norm_min': 18.0, 'norm_max': 24.0, # ДИАПАЗОН НОРМЫ
        'unit': '°C', 'name': 'Температура'
    },
    'pressure': {
        'gen_min': 97.5, 'gen_max': 105.5,  # ДИАПАЗОН ГЕНЕРАЦИИ  
        'norm_min': 98.0, 'norm_max': 105.0, # ДИАПАЗОН НОРМЫ
        'unit': 'kPa', 'name': 'Давление'
    },
    'humidity': {
        'gen_min': 28.0, 'gen_max': 62.0,   # ДИАПАЗОН ГЕНЕРАЦИИ
        'norm_min': 30.0, 'norm_max': 60.0,  # ДИАПАЗОН НОРМЫ
        'unit': '%', 'name': 'Влажность'
    },
    'gas_composition': {
        'gen_min': 380.0, 'gen_max': 620.0, # ДИАПАЗОН ГЕНЕРАЦИИ
        'norm_min': 400.0, 'norm_max': 600.0, # ДИАПАЗОН НОРМЫ
        'unit': 'ppm', 'name': 'Уровень CO₂'
    },
    'noise_level': {
        'gen_min': 0.0, 'gen_max': 62.0,    # ДИАПАЗОН ГЕНЕРАЦИИ
        'norm_min': 0.0, 'norm_max': 60.0,   # ДИАПАЗОН НОРМЫ
        'unit': 'dB', 'name': 'Уровень шума'
    }
}

# Уличные датчики (для главной страницы)
SENSOR_LOCATIONS = {
    1: {'name': 'Датчик №1 - Главный корпус', 'lat': 55.7558, 'lng': 37.6176, 'color': '#118899'},
    2: {'name': 'Датчик №2 - Лаборатория', 'lat': 55.7560, 'lng': 37.6178, 'color': '#4FA8B5'},
    3: {'name': 'Датчик №3 - Склад', 'lat': 55.7556, 'lng': 37.6174, 'color': '#0D6A77'},
    4: {'name': 'Датчик №4 - Парковка', 'lat': 55.7559, 'lng': 37.6172, 'color': '#1A9BA8'},
    5: {'name': 'Датчик №5 - Офис', 'lat': 55.7557, 'lng': 37.6179, 'color': '#2CA3B0'}
}

TEST_DATA_DAYS = 30
TEST_DATA_INTERVAL = 3