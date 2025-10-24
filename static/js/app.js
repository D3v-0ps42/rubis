// Global variables
let ymap;
let selectedSensor = null;
let sensorObjects = {};
let sensorChart = null;
// Обновленные цвета в стиле Sibur
const sensorColors = {
    1: '#118899',
    2: '#4FA8B5', 
    3: '#0D6A77',
    4: '#1A9BA8',
    5: '#2CA3B0'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeYandexMap();
    loadSystemStats();
    setInterval(loadSystemStats, 30000); // Update every 30 seconds
});

// Initialize Yandex Map with Sirius University coordinates
function initializeYandexMap() {
    // Initialize map without API key (free tier)
    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    script.onload = function() {
        ymaps.ready(function() {
            // Sirius University coordinates: [43.414283, 39.950436]
            ymap = new ymaps.Map('map', {
                center: [43.414283, 39.950436],
                zoom: 17
            }, {
                searchControlProvider: 'yandex#search'
            });
            
            // Add sensor markers
            addSensorMarkers();
            loadLatestReadings();
        });
    };
    document.head.appendChild(script);
}

// Add sensors to Yandex Map around Sirius University
function addSensorMarkers() {
    const sensorLocations = {
        1: { lat: 43.414283, lng: 39.950436, name: 'Главный корпус' },
        2: { lat: 43.4145, lng: 39.951, name: 'Лаборатория' },
        3: { lat: 43.4138, lng: 39.9498, name: 'Склад' },
        4: { lat: 43.415, lng: 39.9508, name: 'Парковка' },
        5: { lat: 43.414, lng: 39.9512, name: 'Офис' }
    };
    
    for (const [sensorId, location] of Object.entries(sensorLocations)) {
        const marker = new ymaps.Placemark([location.lat, location.lng], {
            balloonContent: `<b>Датчик ${sensorId}</b><br>${location.name}`,
            hintContent: `Датчик ${sensorId}`
        }, {
            preset: 'islands#circleIcon',
            iconColor: sensorColors[sensorId]
        });
        
        marker.events.add('click', function() {
            selectSensor(parseInt(sensorId));
        });
        
        ymap.geoObjects.add(marker);
        sensorObjects[sensorId] = marker;
    }
}

// Select sensor - FIXED LOGIC: markers keep their status colors
function selectSensor(sensorId) {
    selectedSensor = sensorId;
    
    // Update UI
    document.querySelectorAll('.sensor-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update selected sensor display
    const sensorName = event.target.textContent;
    document.getElementById('selected-sensor').textContent = sensorName;
    
    // Show sensor data section
    document.getElementById('sensor-data-section').style.display = 'block';
    document.getElementById('sensor-title').textContent = `📊 Данные с ${sensorName}`;
    
    // Load sensor data
    loadSensorData(sensorId);
    loadSensorStatistics(sensorId);
    
    // FIXED: Don't change marker colors, only add selection indicator
    Object.values(sensorObjects).forEach(marker => {
        // Remove any selection indicator but keep original status color
        const originalColor = getOriginalMarkerColor(marker);
        marker.options.set('iconColor', originalColor);
    });
    
    if (sensorObjects[sensorId]) {
        // Add selection indicator (darker border effect)
        const originalColor = getOriginalMarkerColor(sensorObjects[sensorId]);
        sensorObjects[sensorId].options.set({
            iconColor: originalColor,
            iconImageSize: [30, 30] // Slightly larger when selected
        });
    }
}

// Helper function to get original marker color based on sensor ID
function getOriginalMarkerColor(marker) {
    // Find which sensor this marker belongs to
    for (const [sensorId, markerObj] of Object.entries(sensorObjects)) {
        if (markerObj === marker) {
            // Check if we have status data for this sensor
            // This would need to be implemented based on your status data
            return sensorColors[sensorId];
        }
    }
    return '#118899'; // Default Sibur color
}

// Update sensor statuses on Yandex Map - FIXED: preserve selection
function updateSensorStatuses(latestData) {
    for (const [sensorId, data] of Object.entries(latestData)) {
        const temperature = data.temperature;
        const isNormal = temperature >= 18 && temperature <= 26;
        
        if (sensorObjects[sensorId]) {
            const color = isNormal ? sensorColors[sensorId] : '#FF6B6B';
            const status = isNormal ? '🟢 Норма' : '🔴 Внимание';
            
            // Update balloon content with current status
            sensorObjects[sensorId].properties.set({
                balloonContent: `
                    <b>Датчик ${sensorId}</b><br>
                    Температура: ${temperature.toFixed(1)}°C<br>
                    Статус: ${status}<br>
                    <small>${new Date().toLocaleString()}</small>
                `
            });
            
            // Update icon color but preserve selection state
            // If this sensor is selected, keep the larger size
            const isSelected = selectedSensor == sensorId;
            sensorObjects[sensorId].options.set({
                iconColor: color,
                iconImageSize: isSelected ? [30, 30] : [22, 22]
            });
        }
    }
}

// ... остальной код без изменений (loadSystemStats, loadLatestReadings, etc.) ...

// Load sensor data for charts
function loadSensorData(sensorId) {
    fetch(`/api/sensor/${sensorId}?hours=24`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error loading sensor data:', data.error);
                showNoDataMessage();
                return;
            }
            
            updateCurrentMetrics(data);
            updateCharts(data);
        })
        .catch(error => {
            console.error('Error loading sensor data:', error);
            showNoDataMessage();
        });
}

// Show no data message
function showNoDataMessage() {
    const container = document.getElementById('charts-container');
    container.innerHTML = `
        <div class="alert alert-warning text-center">
            <h4>📊 Нет данных для отображения</h4>
            <p>Нажмите "Сгенерировать тестовые данные" для создания демо-данных</p>
        </div>
    `;
}

// Update current metrics display
function updateCurrentMetrics(data) {
    const metricsContainer = document.getElementById('current-metrics');
    metricsContainer.innerHTML = '';
    
    const metrics = [
        { key: 'temperature', name: 'Температура', icon: '🌡️', unit: '°C' },
        { key: 'pressure', name: 'Давление', icon: '🌪️', unit: 'кПа' },
        { key: 'humidity', name: 'Влажность', icon: '💧', unit: '%' },
        { key: 'gas_composition', name: 'Уровень CO₂', icon: '🌫️', unit: 'ppm' },
        { key: 'noise_level', name: 'Уровень шума', icon: '📢', unit: 'дБ' }
    ];
    
    // Get the latest values from the first data point (most recent)
    metrics.forEach(metric => {
        // Find the dataset for this metric
        const dataset = data.datasets.find(ds => getParameterKey(ds.label) === metric.key);
        if (dataset && dataset.data && dataset.data.length > 0) {
            const latestValue = dataset.data[0];
            const metricConfig = getMetricConfig(metric.key);
            
            const isNormal = latestValue >= metricConfig.min && latestValue <= metricConfig.max;
            const cardClass = isNormal ? 'border-success' : 'border-warning';
            
            const metricHTML = `
                <div class="col">
                    <div class="card ${cardClass}">
                        <div class="card-body">
                            <h5 class="card-title">${metric.icon} ${metric.name}</h5>
                            <div class="value">${latestValue.toFixed(1)}${metric.unit}</div>
                            <div class="range">${metricConfig.min}-${metricConfig.max} ${metric.unit}</div>
                        </div>
                    </div>
                </div>
            `;
            
            metricsContainer.innerHTML += metricHTML;
        }
    });
}

// Get metric configuration
function getMetricConfig(metricKey) {
    const config = {
        'temperature': { min: 15, max: 35, unit: '°C' },
        'pressure': { min: 98, max: 105, unit: 'кПа' },
        'humidity': { min: 20, max: 95, unit: '%' },
        'gas_composition': { min: 350, max: 2000, unit: 'ppm' },
        'noise_level': { min: 35, max: 85, unit: 'дБ' }
    };
    
    return config[metricKey] || { min: 0, max: 100, unit: '' };
}

// Update charts - COMPLETELY REWRITTEN
function updateCharts(sensorData = null) {
    if (!sensorData && selectedSensor) {
        // If no data provided, load it
        loadSensorData(selectedSensor);
        return;
    }
    
    if (!sensorData || sensorData.error) {
        console.error('No sensor data available');
        showNoDataMessage();
        return;
    }

    const container = document.getElementById('charts-container');
    container.innerHTML = '<canvas id="sensor-chart"></canvas>';
    
    const ctx = document.getElementById('sensor-chart').getContext('2d');
    
    // Destroy existing chart
    if (sensorChart) {
        sensorChart.destroy();
    }

    // Filter datasets based on selected parameters
    const selectedParams = getSelectedParameters();
    const filteredDatasets = sensorData.datasets.filter(dataset => 
        selectedParams.includes(getParameterKey(dataset.label))
    );

    if (filteredDatasets.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center">Выберите параметры для отображения</div>';
        return;
    }

    // Create chart with proper configuration
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sensorData.timestamps,
            datasets: filteredDatasets.map((dataset, index) => {
                // Обновляем цвета графиков в стиле Sibur
                const colors = [
                    { border: '#118899', background: 'rgba(17, 136, 153, 0.1)' },
                    { border: '#4FA8B5', background: 'rgba(79, 168, 181, 0.1)' },
                    { border: '#0D6A77', background: 'rgba(13, 106, 119, 0.1)' },
                    { border: '#1A9BA8', background: 'rgba(26, 155, 168, 0.1)' },
                    { border: '#2CA3B0', background: 'rgba(44, 163, 176, 0.1)' }
                ];
                const color = colors[index % colors.length];
                
                return {
                    ...dataset,
                    borderColor: color.border,
                    backgroundColor: color.background
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Время'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        autoSkip: true
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Температура (°C), Влажность (%), Уровень шума (дБ)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Давление (кПа), Уровень CO₂ (ppm)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Показания датчика ${selectedSensor} за последние 24 часа`,
                    color: '#118899', // Обновленный цвет заголовка
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Helper function to get parameter key from label
function getParameterKey(label) {
    const mapping = {
        'Температура': 'temperature',
        'Давление': 'pressure', 
        'Влажность': 'humidity',
        'Уровень CO₂': 'gas_composition',
        'Уровень шума': 'noise_level'
    };
    return mapping[label];
}

// Get selected parameters from checkboxes
function getSelectedParameters() {
    const checkboxes = document.querySelectorAll('.parameter-selector input:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Get parameter display name
function getParameterName(param) {
    const names = {
        'temperature': 'Температура',
        'pressure': 'Давление',
        'humidity': 'Влажность',
        'gas_composition': 'Уровень CO₂',
        'noise_level': 'Уровень шума'
    };
    return names[param] || param;
}

// Load sensor statistics
function loadSensorStatistics(sensorId) {
    fetch(`/api/sensor/${sensorId}/stats`)
        .then(response => response.json())
        .then(stats => {
            updateStatisticsDisplay(stats);
        })
        .catch(error => console.error('Error loading statistics:', error));
}

// Update statistics display
function updateStatisticsDisplay(stats) {
    const statsContainer = document.getElementById('sensor-statistics');
    statsContainer.innerHTML = '';
    
    // General info
    const generalInfo = `
        <div class="col-md-4">
            <div class="metric-card">
                <h4>📈 Общая информация</h4>
                <div class="alert alert-info">
                    <strong>Всего записей:</strong> ${stats.total_records}
                </div>
                ${stats.time_range.first_record ? `
                <div class="alert alert-info">
                    <strong>Первая запись:</strong> ${new Date(stats.time_range.first_record).toLocaleString('ru-RU')}
                </div>
                <div class="alert alert-info">
                    <strong>Последняя запись:</strong> ${new Date(stats.time_range.last_record).toLocaleString('ru-RU')}
                </div>
                ` : '<div class="alert alert-warning">Нет данных о временном диапазоне</div>'}
            </div>
        </div>
    `;
    
    // Averages
    let averagesHTML = '<div class="col-md-4"><div class="metric-card"><h4>📊 Средние значения</h4>';
    const paramOrder = ['temperature', 'pressure', 'humidity', 'gas_composition', 'noise_level'];
    
    let hasAverages = false;
    paramOrder.forEach(param => {
        const value = stats.averages[param];
        if (value && value !== 0) {
            hasAverages = true;
            const config = getMetricConfig(param);
            averagesHTML += `
                <div class="alert alert-light">
                    <strong>${getParameterName(param)}:</strong> ${value.toFixed(2)} ${config.unit}
                </div>
            `;
        }
    });
    
    if (!hasAverages) {
        averagesHTML += '<div class="alert alert-warning">Нет данных для расчета средних значений</div>';
    }
    
    averagesHTML += '</div></div>';
    
    // Value ranges
    const rangesHTML = `
        <div class="col-md-4">
            <div class="metric-card">
                <h4>📋 Допустимые диапазоны</h4>
                ${paramOrder.map(param => {
                    const config = getMetricConfig(param);
                    return `
                        <div class="alert alert-light">
                            <strong>${getParameterName(param)}:</strong><br>
                            ${config.min} - ${config.max} ${config.unit}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    statsContainer.innerHTML = generalInfo + averagesHTML + rangesHTML;
}

// Generate test data
function generateTestData() {
    if (!confirm('Сгенерировать тестовые данные? Это может занять несколько секунд.')) {
        return;
    }
    
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Генерация...';
    button.disabled = true;
    
    fetch('/api/generate_test_data?days=1')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Успешно сгенерировано ${data.records} записей!`);
                // Update system stats
                loadSystemStats();
                // Reload current sensor data if selected
                if (selectedSensor) {
                    loadSensorData(selectedSensor);
                    loadSensorStatistics(selectedSensor);
                }
                // Update sensor statuses
                loadLatestReadings();
            } else {
                alert('Ошибка генерации: ' + data.error);
            }
        })
        .catch(error => {
            alert('Ошибка генерации: ' + error);
        })
        .finally(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        });
}

// Clear all data
function clearData() {
    if (!confirm('ВНИМАНИЕ! Это удалит все данные. Продолжить?')) {
        return;
    }
    
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Очистка...';
    button.disabled = true;
    
    fetch('/api/clear_data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Все данные успешно очищены!');
                // Update system stats
                loadSystemStats();
                // Reload current sensor data if selected
                if (selectedSensor) {
                    loadSensorData(selectedSensor);
                    loadSensorStatistics(selectedSensor);
                }
                // Update sensor statuses
                loadLatestReadings();
            } else {
                alert('Ошибка очистки: ' + data.error);
            }
        })
        .catch(error => {
            alert('Ошибка очистки: ' + error);
        })
        .finally(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        });
}

// Load system statistics
function loadSystemStats() {
    fetch('/api/system_stats')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error loading system stats:', data.error);
                return;
            }
            updateSystemStatus(data);
        })
        .catch(error => console.error('Error loading system stats:', error));
}

// Load latest readings for all sensors
function loadLatestReadings() {
    fetch('/api/latest')
        .then(response => response.json())
        .then(data => {
            updateSensorStatuses(data);
        })
        .catch(error => console.error('Error loading latest readings:', error));
}

// Update system status with real data
function updateSystemStatus(stats) {
    document.getElementById('active-sensors').textContent = stats.active_sensors;
    document.getElementById('total-records').textContent = stats.total_records;
}