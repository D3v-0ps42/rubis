import psycopg2
import datetime
import pandas as pd
from config import DATABASE_CONFIG, SENSOR_LOCATIONS
import threading
from psycopg2.extras import RealDictCursor

class SensorDatabase:
    _local = threading.local()
    
    def __init__(self, db_config=DATABASE_CONFIG):
        self.db_config = db_config
        self._init_database()
    
    def _get_connection(self):
        if not hasattr(self._local, 'connection'):
            self._local.connection = psycopg2.connect(**self.db_config)
            self._local.connection.autocommit = False
        return self._local.connection
    
    def _init_database(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id SERIAL PRIMARY KEY,
            sensor_id INTEGER NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            noise_level REAL,
            gas_composition REAL,
            pressure REAL,
            humidity REAL,
            temperature REAL
        )
        ''')
        
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_timestamp_sensor 
        ON sensor_readings(timestamp, sensor_id)
        ''')
        
        conn.commit()
    
    def add_reading(self, sensor_id, noise, gas, pressure, humidity, temp, timestamp=None):
        if timestamp is None:
            timestamp = datetime.datetime.now()
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            INSERT INTO sensor_readings 
            (sensor_id, timestamp, noise_level, gas_composition, pressure, humidity, temperature)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (sensor_id, timestamp, noise, gas, pressure, humidity, temp))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Ошибка при добавлении данных: {e}")
            conn.rollback()
            return False
    
    def get_sensor_data(self, sensor_id, hours=24):
        """Получить данные конкретного датчика"""
        try:
            conn = self._get_connection()
            cutoff_time = datetime.datetime.now() - datetime.timedelta(hours=hours)
            
            query = """
            SELECT * FROM sensor_readings 
            WHERE sensor_id = %s AND timestamp > %s
            ORDER BY timestamp DESC
            """
            
            df = pd.read_sql_query(query, conn, params=[sensor_id, cutoff_time])
            if not df.empty and 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
            return df
        except Exception as e:
            print(f"Ошибка при получении данных датчика {sensor_id}: {e}")
            return pd.DataFrame()
    
    def get_all_sensors_data(self, hours=24):
        """Получить данные всех датчиков"""
        try:
            conn = self._get_connection()
            cutoff_time = datetime.datetime.now() - datetime.timedelta(hours=hours)
            
            query = """
            SELECT * FROM sensor_readings 
            WHERE timestamp > %s
            ORDER BY sensor_id, timestamp DESC
            """
            
            df = pd.read_sql_query(query, conn, params=[cutoff_time])
            if not df.empty and 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
            return df
        except Exception as e:
            print(f"Ошибка при получении всех данных: {e}")
            return pd.DataFrame()
    
    def get_latest_readings(self):
        """Получить последние показания всех датчиков"""
        try:
            conn = self._get_connection()
            
            query = """
            SELECT DISTINCT ON (sensor_id) *
            FROM sensor_readings 
            ORDER BY sensor_id, timestamp DESC
            """
            
            df = pd.read_sql_query(query, conn)
            if not df.empty and 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
            return df
        except Exception as e:
            print(f"Ошибка при получении последних показаний: {e}")
            return pd.DataFrame()
    
    def get_sensor_statistics(self, sensor_id):
        """Статистика для конкретного датчика"""
        stats = {}
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Средние значения
            cursor.execute('''
            SELECT 
                AVG(noise_level),
                AVG(gas_composition), 
                AVG(pressure),
                AVG(humidity),
                AVG(temperature)
            FROM sensor_readings
            WHERE sensor_id = %s
            ''', (sensor_id,))
            
            averages = cursor.fetchone()
            stats['averages'] = {
                'noise_level': float(averages[0]) if averages[0] is not None else 0,
                'gas_composition': float(averages[1]) if averages[1] is not None else 0,
                'pressure': float(averages[2]) if averages[2] is not None else 0,
                'humidity': float(averages[3]) if averages[3] is not None else 0,
                'temperature': float(averages[4]) if averages[4] is not None else 0
            }
            
            # Количество записей
            cursor.execute('SELECT COUNT(*) FROM sensor_readings WHERE sensor_id = %s', (sensor_id,))
            count_result = cursor.fetchone()
            stats['total_records'] = count_result[0] if count_result else 0
            
            # Временной диапазон
            cursor.execute('SELECT MIN(timestamp), MAX(timestamp) FROM sensor_readings WHERE sensor_id = %s', (sensor_id,))
            time_range = cursor.fetchone()
            stats['time_range'] = {
                'first_record': time_range[0].strftime('%Y-%m-%d %H:%M:%S') if time_range and time_range[0] else None,
                'last_record': time_range[1].strftime('%Y-%m-%d %H:%M:%S') if time_range and time_range[1] else None
            }
            
        except Exception as e:
            print(f"Ошибка при получении статистики датчика {sensor_id}: {e}")
            stats = {
                'averages': {'noise_level': 0, 'gas_composition': 0, 'pressure': 0, 'humidity': 0, 'temperature': 0},
                'total_records': 0,
                'time_range': {'first_record': None, 'last_record': None}
            }
        
        return stats
    
    def clear_database(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM sensor_readings')
            conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при очистке базы данных: {e}")
            return False
    
    def close(self):
        if hasattr(self._local, 'connection'):
            self._local.connection.close()
            del self._local.connection