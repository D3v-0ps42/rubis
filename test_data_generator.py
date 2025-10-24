import random
import datetime
import pandas as pd
from database import SensorDatabase
from config import SENSOR_CONFIG, TEST_DATA_DAYS, TEST_DATA_INTERVAL, SENSOR_LOCATIONS

class TestDataGenerator:
    def __init__(self):
        self.db = SensorDatabase()
    
    def generate_realistic_data(self, days=TEST_DATA_DAYS, interval_minutes=TEST_DATA_INTERVAL):
        """
        Генерация реалистичных тестовых данных для всех датчиков
        """
        print(f"Генерация тестовых данных за {days} дней для {len(SENSOR_LOCATIONS)} датчиков...")
        
        end_time = datetime.datetime.now()
        start_time = end_time - datetime.timedelta(days=days)
        
        records_added = 0
        
        # Генерируем данные для каждого датчика
        for sensor_id in SENSOR_LOCATIONS.keys():
            print(f"Генерация данных для датчика {sensor_id}...")
            sensor_records = self._generate_sensor_data(sensor_id, start_time, end_time, interval_minutes)
            records_added += sensor_records
        
        print(f"Генерация завершена! Добавлено {records_added} записей")
        
        # Показываем статистику
        for sensor_id in SENSOR_LOCATIONS.keys():
            stats = self.db.get_sensor_statistics(sensor_id)
            print(f"Датчик {sensor_id}: {stats['total_records']} записей")
        
        self.db.close()
        return records_added
    
    def _generate_sensor_data(self, sensor_id, start_time, end_time, interval_minutes):
        """Генерация данных для одного датчика"""
        current_time = start_time
        records_added = 0
        batch_data = []
        
        # Базовые значения для каждого датчика (немного разные)
        base_values = {
            'noise': random.uniform(40.0, 70.0),
            'gas': random.uniform(400.0, 1000.0),
            'pressure': random.uniform(100.0, 102.0),
            'humidity': random.uniform(40.0, 80.0),
            'temperature': random.uniform(18.0, 28.0)
        }
        
        while current_time < end_time:
            # Получаем час дня для реалистичных циклов
            hour = current_time.hour
            
            # Генерация данных с суточными вариациями
            if 0 <= hour <= 6:  # Ночь
                noise_variation = -10.0
                temp_variation = -5.0
                humidity_variation = +15.0
            elif 7 <= hour <= 9:  # Утро
                noise_variation = +5.0
                temp_variation = 0.0
                humidity_variation = +5.0
            elif 10 <= hour <= 17:  # День
                noise_variation = +15.0
                temp_variation = +5.0
                humidity_variation = -10.0
            else:  # Вечер
                noise_variation = 0.0
                temp_variation = 0.0
                humidity_variation = 0.0
            
            # Генерируем значения с вариациями
            noise = base_values['noise'] + noise_variation + random.uniform(-5.0, 5.0)
            gas = base_values['gas'] + random.uniform(-50.0, 50.0)
            pressure = base_values['pressure'] + random.uniform(-0.5, 0.5)
            humidity = base_values['humidity'] + humidity_variation + random.uniform(-5.0, 5.0)
            temperature = base_values['temperature'] + temp_variation + random.uniform(-2.0, 2.0)
            
            # Ограничиваем значения разумными пределами
            noise = max(30, min(90, noise))
            gas = max(350, min(2000, gas))
            pressure = max(98, min(105, pressure))
            humidity = max(20, min(95, humidity))
            temperature = max(15, min(35, temperature))
            
            # Добавляем в батч
            batch_data.append((
                sensor_id, current_time, noise, gas, pressure, humidity, temperature
            ))
            records_added += 1
            
            # Переходим к следующему временному интервалу
            current_time += datetime.timedelta(minutes=interval_minutes)
            
            # Сохраняем батч каждые 100 записей
            if len(batch_data) >= 100:
                self._save_batch(batch_data)
                batch_data = []
        
        # Сохраняем оставшиеся данные
        if batch_data:
            self._save_batch(batch_data)
        
        return records_added
    
    def _save_batch(self, batch_data):
        """Сохранение батча данных в базу"""
        try:
            for data in batch_data:
                sensor_id, timestamp, noise, gas, pressure, humidity, temperature = data
                self.db.add_reading(sensor_id, noise, gas, pressure, humidity, temperature, timestamp)
        except Exception as e:
            print(f"Ошибка при сохранении батча: {e}")

# Функция для быстрого вызова
def generate_test_data(days=TEST_DATA_DAYS):
    generator = TestDataGenerator()
    return generator.generate_realistic_data(days)

if __name__ == "__main__":
    generate_test_data(7)