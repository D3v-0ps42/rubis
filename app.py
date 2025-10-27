from flask import Flask, render_template, jsonify, request
from database import SensorDatabase
from test_data_generator import generate_test_data
from config import SENSOR_CONFIG, SENSOR_LOCATIONS
import json
from datetime import datetime, timedelta
from flask import send_from_directory
import os
import psycopg2

app = Flask(__name__)

# Инициализация основной базы данных
db = SensorDatabase()

# Функция для получения иконок параметров
def get_param_icon(param):
    icons = {
        'temperature': 'temperature-high',
        'pressure': 'wind', 
        'humidity': 'tint',
        'gas_composition': 'smog',
        'noise_level': 'volume-up'
    }
    return icons.get(param, 'chart-line')

@app.context_processor
def utility_processor():
    return dict(get_param_icon=get_param_icon)

@app.route('/')
def index():
    return render_template('index.html', 
                         sensor_locations=SENSOR_LOCATIONS,
                         sensor_config=SENSOR_CONFIG)

# ДОБАВЛЯЕМ НОВЫЙ ENDPOINT ДЛЯ ПРИЕМА ДАННЫХ ОТ ESP32
@app.route('/api/esp32_data', methods=['POST'])
def receive_esp32_data():
    """
    Принимает данные от ESP32 и сохраняет в базу данных
    Ожидает JSON в формате:
    {
        "temperature": 23.5,
        "pressure": 101.3,
        "humidity": 45.0,
        "gas_composition": 450.0,
        "noise_level": 35.0
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
        
        # Проверяем наличие всех необходимых полей
        required_fields = ['temperature', 'pressure', 'humidity', 'gas_composition', 'noise_level']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        # Сохраняем данные в базу с sensor_id=99 (реальный датчик)
        success = db.add_reading(
            sensor_id=99,
            noise=data['noise_level'],
            gas=data['gas_composition'],
            pressure=data['pressure'],
            humidity=data['humidity'],
            temp=data['temperature'],
            timestamp=datetime.now()
        )
        
        if success:
            print(f"Данные от ESP32 успешно сохранены: {data}")
            return jsonify({'success': True, 'message': 'Data received successfully'})
        else:
            return jsonify({'success': False, 'error': 'Database error'}), 500
            
    except Exception as e:
        print(f"Ошибка при обработке данных от ESP32: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# API для получения последних данных реального датчика
@app.route('/api/real_sensor/latest')
def get_real_sensor_latest():
    """Получаем последние данные реального датчика"""
    try:
        conn = db._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT temperature, pressure, humidity, gas_composition, noise_level, timestamp 
            FROM sensor_readings 
            WHERE sensor_id = 99 
            ORDER BY timestamp DESC 
            LIMIT 1
        ''')
        
        result = cursor.fetchone()
        
        if result:
            data = {
                'temperature': result[0],
                'pressure': result[1],
                'humidity': result[2],
                'gas_composition': result[3],
                'noise_level': result[4],
                'timestamp': result[5].strftime('%Y-%m-%d %H:%M:%S'),
                'success': True
            }
        else:
            data = {'success': False, 'message': 'No data available'}
        
        return jsonify(data)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/sensor/<int:sensor_id>')
def get_sensor_data(sensor_id):
    hours = request.args.get('hours', 24, type=int)
    
    # Для реального датчика возвращаем только последние данные
    if sensor_id == 99:
        return get_real_sensor_data()
    
    sensor_data = db.get_sensor_data(sensor_id, hours)
    
    if sensor_data.empty:
        return jsonify({'error': 'Нет данных'})
    
    # ИСПРАВЛЕНИЕ: правильный порядок времени (слева-направо)
    timestamps = sensor_data['timestamp'].dt.strftime('%H:%M').tolist()
    timestamps.reverse()
    
    datasets = [
    {
        'label': 'Температура',
        'data': sensor_data['temperature'].tolist(),
        'borderColor': '#0D6A77',  # Темный синий
        'backgroundColor': 'rgba(13, 106, 119, 0.1)',
        'yAxisID': 'y'
    },
    {
        'label': 'Давление', 
        'data': sensor_data['pressure'].tolist(),
        'borderColor': '#4FA8B5',  # Светлый синий
        'backgroundColor': 'rgba(79, 168, 181, 0.1)',
        'yAxisID': 'y1'
    },
    {
        'label': 'Влажность',
        'data': sensor_data['humidity'].tolist(), 
        'borderColor': '#2E8B57',  # Морской зеленый
        'backgroundColor': 'rgba(46, 139, 87, 0.1)',
        'yAxisID': 'y'
    },
    {
        'label': 'Уровень CO₂',
        'data': sensor_data['gas_composition'].tolist(),
        'borderColor': '#8A2BE2',  # Сине-фиолетовый
        'backgroundColor': 'rgba(138, 43, 226, 0.1)',
        'yAxisID': 'y1'
    },
    {
        'label': 'Уровень шума',
        'data': sensor_data['noise_level'].tolist(),
        'borderColor': '#FF6347',  # Томатный красный
        'backgroundColor': 'rgba(255, 99, 71, 0.1)',
        'yAxisID': 'y'
    }
]
    
    data = {
        'timestamps': timestamps,
        'datasets': datasets
    }
    
    return jsonify(data)

def get_real_sensor_data():
    """Получаем данные реального датчика (только последние значения)"""
    try:
        conn = db._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT temperature, pressure, humidity, gas_composition, noise_level, timestamp 
            FROM sensor_readings 
            WHERE sensor_id = 99 
            ORDER BY timestamp DESC 
            LIMIT 1
        ''')
        
        result = cursor.fetchone()
        
        if result:
            # Для реального датчика возвращаем только последние значения
            data = {
                'timestamps': [datetime.now().strftime('%H:%M')],
                'datasets': [
                    {
                        'label': 'Температура',
                        'data': [result[0]],
                        'borderColor': '#0D6A77',
                        'backgroundColor': 'rgba(13, 106, 119, 0.1)',
                        'yAxisID': 'y'
                    },
                    {
                        'label': 'Давление',
                        'data': [result[1]],
                        'borderColor': '#4FA8B5',
                        'backgroundColor': 'rgba(79, 168, 181, 0.1)',
                        'yAxisID': 'y1'
                    },
                    {
                        'label': 'Влажность',
                        'data': [result[2]],
                        'borderColor': '#2E8B57',
                        'backgroundColor': 'rgba(46, 139, 87, 0.1)',
                        'yAxisID': 'y'
                    },
                    {
                        'label': 'Уровень CO₂',
                        'data': [result[3]],
                        'borderColor': '#8A2BE2',
                        'backgroundColor': 'rgba(138, 43, 226, 0.1)',
                        'yAxisID': 'y1'
                    },
                    {
                        'label': 'Уровень шума',
                        'data': [result[4]],
                        'borderColor': '#FF6347',
                        'backgroundColor': 'rgba(255, 99, 71, 0.1)',
                        'yAxisID': 'y'
                    }
                ],
                'real_sensor': True
            }
            return jsonify(data)
        else:
            return jsonify({'error': 'Нет данных от реального датчика'})
            
    except Exception as e:
        return jsonify({'error': str(e)})

# API для статистики уличных датчиков
@app.route('/api/system_stats')
def get_system_stats():
    try:
        conn = db._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM sensor_readings')
        total_records = cursor.fetchone()[0]
        
        cutoff_time = datetime.now() - timedelta(hours=24)
        cursor.execute('SELECT COUNT(DISTINCT sensor_id) FROM sensor_readings WHERE timestamp > %s', (cutoff_time,))
        active_sensors = cursor.fetchone()[0]
        
        return jsonify({
            'total_records': total_records,
            'active_sensors': active_sensors,
            'total_sensors': len(SENSOR_LOCATIONS)
        })
    except Exception as e:
        return jsonify({'error': str(e)})

# СУЩЕСТВУЮЩИЕ ЭНДПОИНТЫ
@app.route('/api/sensor/<int:sensor_id>/stats')
def get_sensor_stats(sensor_id):
    stats = db.get_sensor_statistics(sensor_id)
    return jsonify(stats)

@app.route('/api/latest')
def get_latest_readings():
    latest = db.get_latest_readings()
    if latest.empty:
        return jsonify({})
    
    latest_data = {}
    for _, row in latest.iterrows():
        latest_data[row['sensor_id']] = {
            'temperature': row['temperature'],
            'pressure': row['pressure'],
            'humidity': row['humidity'],
            'gas_composition': row['gas_composition'],
            'noise_level': row['noise_level'],
            'timestamp': row['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
        }
    
    return jsonify(latest_data)

@app.route('/api/generate_test_data')
def api_generate_test_data():
    try:
        days = request.args.get('days', 1, type=int)
        records = generate_test_data(days)
        
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM sensor_readings')
        total_records = cursor.fetchone()[0]
        
        return jsonify({
            'success': True, 
            'records': records,
            'total_records': total_records
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# ИСПРАВЛЕННАЯ ФУНКЦИЯ - ЗАМЕНЯЕМ СУЩЕСТВУЮЩУЮ, А НЕ ДОБАВЛЯЕМ НОВУЮ
@app.route('/api/clear_data')
def api_clear_data():
    try:
        # Очищаем только тестовые данные, оставляем данные реального датчика
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM sensor_readings WHERE sensor_id != 99')
        conn.commit()
        
        cursor.execute('SELECT COUNT(*) FROM sensor_readings')
        total_records = cursor.fetchone()[0]
        
        return jsonify({'success': True, 'total_records': total_records})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/sensor_config')
def get_sensor_config():
    """Отдаем конфигурацию датчиков в JavaScript"""
    return jsonify(SENSOR_CONFIG)

@app.route('/api/sensor_locations')
def get_sensor_locations():
    """Отдаем локации датчиков в JavaScript"""
    return jsonify(SENSOR_LOCATIONS)

# ДОБАВЛЯЕМ ENDPOINT ДЛЯ ОЧИСТКИ ДАННЫХ РЕАЛЬНОГО ДАТЧИКА
@app.route('/api/clear_real_sensor_data')
def api_clear_real_sensor_data():
    try:
        # Очищаем только данные реального датчика
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM sensor_readings WHERE sensor_id = 99')
        conn.commit()
        
        cursor.execute('SELECT COUNT(*) FROM sensor_readings WHERE sensor_id = 99')
        remaining_records = cursor.fetchone()[0]
        
        return jsonify({'success': True, 'remaining_records': remaining_records})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)