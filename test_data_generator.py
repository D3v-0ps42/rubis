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
        Генерация реалистичных тестовых данных для всех датчиков, КРОМЕ реального (ID=99)
        """
        print(f"Генерация тестовых данных за {days} дней для датчиков...")
        
        end_time = datetime.datetime.now()
        start_time = end_time - datetime.timedelta(days=days)
        
        records_added = 0
        
        # Генерируем данные для каждого датчика, КРОМЕ реального (ID=99)
        for sensor_id in SENSOR_LOCATIONS.keys():
            if sensor_id == 99:  # Пропускаем реальный датчик
                print(f"Пропускаем реальный датчик {sensor_id}")
                continue
                
            print(f"Генерация данных для датчика {sensor_id}...")
            sensor_records = self._generate_sensor_data(sensor_id, start_time, end_time, interval_minutes)
            records_added += sensor_records
        
        print(f"Генерация завершена! Добавлено {records_added} записей")
        
        # Показываем статистику только для тестовых датчиков
        for sensor_id in SENSOR_LOCATIONS.keys():
            if sensor_id == 99:  # Пропускаем реальный датчик
                continue
            stats = self.db.get_sensor_statistics(sensor_id)
            print(f"Датчик {sensor_id}: {stats['total_records']} записей")
        
        self.db.close()
        return records_added
    
    def _generate_sensor_data(self, sensor_id, start_time, end_time, interval_minutes):
        """Генерация данных для одного датчика"""
        current_time = start_time
        records_added = 0
        batch_data = []
        
        # Базовые значения для каждого датчика в пределах генерации
        base_values = {
            'noise': random.uniform(SENSOR_CONFIG['noise_level']['gen_min'], SENSOR_CONFIG['noise_level']['gen_max']),
            'gas': random.uniform(SENSOR_CONFIG['gas_composition']['gen_min'], SENSOR_CONFIG['gas_composition']['gen_max']),
            'pressure': random.uniform(SENSOR_CONFIG['pressure']['gen_min'], SENSOR_CONFIG['pressure']['gen_max']),
            'humidity': random.uniform(SENSOR_CONFIG['humidity']['gen_min'], SENSOR_CONFIG['humidity']['gen_max']),
            'temperature': random.uniform(SENSOR_CONFIG['temperature']['gen_min'], SENSOR_CONFIG['temperature']['gen_max'])
        }
        
        while current_time < end_time:
            # Генерируем значения без вариаций
            noise = base_values['noise'] + random.uniform(-1.0, 1.0)
            gas = base_values['gas'] + random.uniform(-5.0, 5.0)
            pressure = base_values['pressure'] + random.uniform(-0.5, 0.5)
            humidity = base_values['humidity'] + random.uniform(-1.0, 1.0)
            temperature = base_values['temperature'] + random.uniform(-1.0, 1.0)
            
            # Ограничиваем значения диапазонами генерации
            noise = max(SENSOR_CONFIG['noise_level']['gen_min'], min(SENSOR_CONFIG['noise_level']['gen_max'], noise))
            gas = max(SENSOR_CONFIG['gas_composition']['gen_min'], min(SENSOR_CONFIG['gas_composition']['gen_max'], gas))
            pressure = max(SENSOR_CONFIG['pressure']['gen_min'], min(SENSOR_CONFIG['pressure']['gen_max'], pressure))
            humidity = max(SENSOR_CONFIG['humidity']['gen_min'], min(SENSOR_CONFIG['humidity']['gen_max'], humidity))
            temperature = max(SENSOR_CONFIG['temperature']['gen_min'], min(SENSOR_CONFIG['temperature']['gen_max'], temperature))
            
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