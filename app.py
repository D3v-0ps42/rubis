from flask import Flask, render_template, jsonify, request
from database import SensorDatabase
from test_data_generator import generate_test_data
from config import SENSOR_CONFIG, SENSOR_LOCATIONS
import json
from datetime import datetime

app = Flask(__name__)

# Инициализация базы данных
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

@app.route('/api/sensor/<int:sensor_id>')
def get_sensor_data(sensor_id):
    hours = request.args.get('hours', 24, type=int)
    sensor_data = db.get_sensor_data(sensor_id, hours)
    
    if sensor_data.empty:
        return jsonify({'error': 'Нет данных'})
    
    # Преобразуем данные для Chart.js - правильный формат с обновленными цветами Sibur
    data = {
        'timestamps': sensor_data['timestamp'].dt.strftime('%H:%M').tolist(),
        'datasets': [
            {
                'label': 'Температура',
                'data': sensor_data['temperature'].tolist(),
                'borderColor': '#118899',
                'backgroundColor': 'rgba(17, 136, 153, 0.1)',
                'yAxisID': 'y'
            },
            {
                'label': 'Давление', 
                'data': sensor_data['pressure'].tolist(),
                'borderColor': '#4FA8B5',
                'backgroundColor': 'rgba(79, 168, 181, 0.1)',
                'yAxisID': 'y1'
            },
            {
                'label': 'Влажность',
                'data': sensor_data['humidity'].tolist(), 
                'borderColor': '#0D6A77',
                'backgroundColor': 'rgba(13, 106, 119, 0.1)',
                'yAxisID': 'y'
            },
            {
                'label': 'Уровень CO₂',
                'data': sensor_data['gas_composition'].tolist(),
                'borderColor': '#1A9BA8',
                'backgroundColor': 'rgba(26, 155, 168, 0.1)',
                'yAxisID': 'y1'
            },
            {
                'label': 'Уровень шума',
                'data': sensor_data['noise_level'].tolist(),
                'borderColor': '#2CA3B0',
                'backgroundColor': 'rgba(44, 163, 176, 0.1)',
                'yAxisID': 'y'
            }
        ]
    }
    
    return jsonify(data)

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
        
        # Return updated stats
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

@app.route('/api/clear_data')
def api_clear_data():
    try:
        success = db.clear_database()
        
        # Return updated stats after clearing
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM sensor_readings')
        total_records = cursor.fetchone()[0]
        
        return jsonify({'success': success, 'total_records': total_records})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/system_stats')
def get_system_stats():
    try:
        conn = db._get_connection()
        cursor = conn.cursor()
        
        # Get total records count
        cursor.execute('SELECT COUNT(*) FROM sensor_readings')
        total_records = cursor.fetchone()[0]
        
        # Get active sensors count (sensors with data in last 24 hours)
        cutoff_time = datetime.now() - datetime.timedelta(hours=24)
        cursor.execute('SELECT COUNT(DISTINCT sensor_id) FROM sensor_readings WHERE timestamp > %s', (cutoff_time,))
        active_sensors = cursor.fetchone()[0]
        
        return jsonify({
            'total_records': total_records,
            'active_sensors': active_sensors
        })
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)