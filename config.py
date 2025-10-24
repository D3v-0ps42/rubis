import datetime

# Настройки базы данных PostgreSQL
DATABASE_CONFIG = {
    'dbname': 'sensor_data',
    'user': 'sensor_user', 
    'password': 'strong_password_123',
    'host': 'localhost',
    'port': 5432
}

# Остальные настройки остаются прежними
SENSOR_CONFIG = {
    'temperature': {'min': 15.0, 'max': 35.0, 'unit': '°C', 'name': 'Температура'},
    'pressure': {'min': 98.0, 'max': 105.0, 'unit': 'kPa', 'name': 'Давление'},
    'humidity': {'min': 20.0, 'max': 95.0, 'unit': '%', 'name': 'Влажность'},
    'gas_composition': {'min': 350.0, 'max': 2000.0, 'unit': 'ppm', 'name': 'Уровень CO₂'},
    'noise_level': {'min': 35.0, 'max': 85.0, 'unit': 'dB', 'name': 'Уровень шума'}
}

SENSOR_LOCATIONS = {
    1: {'name': 'Датчик №1 - Главный корпус', 'lat': 55.7558, 'lng': 37.6176, 'color': '#118899'},
    2: {'name': 'Датчик №2 - Лаборатория', 'lat': 55.7560, 'lng': 37.6178, 'color': '#4FA8B5'},
    3: {'name': 'Датчик №3 - Склад', 'lat': 55.7556, 'lng': 37.6174, 'color': '#0D6A77'},
    4: {'name': 'Датчик №4 - Парковка', 'lat': 55.7559, 'lng': 37.6172, 'color': '#1A9BA8'},
    5: {'name': 'Датчик №5 - Офис', 'lat': 55.7557, 'lng': 37.6179, 'color': '#2CA3B0'}
}

TEST_DATA_DAYS = 30
TEST_DATA_INTERVAL = 3