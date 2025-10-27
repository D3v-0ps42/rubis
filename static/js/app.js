// Global variables
let ymap;
let selectedSensor = null;
let sensorObjects = {};
let sensorChart = null;
let sensorConfig = null; // ← Добавляем для хранения конфига
let sensorLocations = null;

// Colors for sensors
const normalColor = '#118899'; // Sibur blue
const warningColor = '#FF6B35'; // Sibur orange

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем и конфиг и локации параллельно
    Promise.all([
        loadSensorConfig(),
        loadSensorLocations()
    ]).then(() => {
        initializeYandexMap();
        loadSystemStats();
        setInterval(loadSystemStats, 30000);
        setInterval(loadLatestReadings, 30000);
    });
});

// Загружаем конфиг с сервера
function loadSensorConfig() {
    return fetch('/api/sensor_config')
        .then(response => response.json())
        .then(config => {
            sensorConfig = config;
            console.log('Sensor config loaded:', sensorConfig);
        })
        .catch(error => {
            console.error('Error loading sensor config:', error);
            sensorConfig = null;
        });
}

function loadSensorLocations() {
    return fetch('/api/sensor_locations')
        .then(response => response.json())
        .then(locations => {
            sensorLocations = locations;
            console.log('Sensor locations loaded:', sensorLocations);
        })
        .catch(error => {
            console.error('Error loading sensor locations:', error);
            sensorLocations = null;
        });
}

// Единая функция получения конфига
function getMetricConfig(metricKey) {
    if (!sensorConfig || !sensorConfig[metricKey]) {
        console.error('Config not loaded for:', metricKey);
        return { norm_min: 0, norm_max: 100, unit: '' };
    }
    return sensorConfig[metricKey];
}

// Проверка на нормальность
function isParameterNormal(paramName, value) {
    const config = getMetricConfig(paramName);
    return value >= config.norm_min && value <= config.norm_max;
}

// Проверка ВСЕХ параметров для статуса датчика
function areAllParametersNormal(data) {
    if (!data) return false;
    
    return isParameterNormal('temperature', data.temperature) &&
           isParameterNormal('pressure', data.pressure) &&
           isParameterNormal('humidity', data.humidity) &&
           isParameterNormal('gas_composition', data.gas_composition) &&
           isParameterNormal('noise_level', data.noise_level);
}

// Initialize Yandex Map
function initializeYandexMap() {
    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    script.onload = function() {
        ymaps.ready(function() {
            // Используем координаты из конфига для центра карты
            const firstLocation = sensorLocations ? Object.values(sensorLocations)[0] : null;
            const center = firstLocation ? [firstLocation.lat, firstLocation.lng] : [43.414283, 39.950436];
            
            ymap = new ymaps.Map('map', {
                center: center,
                zoom: 17
            }, {
                searchControlProvider: 'yandex#search'
            });
            
            addSensorMarkers();
            loadLatestReadings();
        });
    };
    document.head.appendChild(script);
}

// Add sensors to Yandex Map - FIXED: use full names from config
function addSensorMarkers() {
    if (!sensorLocations) {
        console.error('Sensor locations not loaded');
        return;
    }
    
    for (const [sensorId, location] of Object.entries(sensorLocations)) {
        const marker = new ymaps.Placemark([location.lat, location.lng], {
            balloonContent: `<b>${location.name}</b><br>Статус: Загрузка...`,
            hintContent: location.name
        }, {
            preset: 'islands#circleIcon',
            iconColor: location.color || normalColor, // Используем цвет из конфига
            iconImageSize: [22, 22]
        });
        
        marker.events.add('click', function() {
            selectSensor(parseInt(sensorId), location.name);
        });
        
        ymap.geoObjects.add(marker);
        sensorObjects[sensorId] = {
            marker: marker,
            name: location.name,
            color: location.color || normalColor // Сохраняем оригинальный цвет
        };
    }
}

// Select sensor function
function selectSensor(sensorId, sensorName = null) {
    selectedSensor = sensorId;
    
    // Get sensor name if not provided
    if (!sensorName && sensorObjects[sensorId]) {
        sensorName = sensorObjects[sensorId].name;
    }
    
    // Update UI buttons
    document.querySelectorAll('.sensor-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.getAttribute('data-sensor-id')) === sensorId) {
            btn.classList.add('active');
        }
    });
    
    // Update selected sensor display
    document.getElementById('selected-sensor').innerHTML = 
        `<i class="fas fa-microchip"></i> ${sensorName || `Датчик ${sensorId}`}`;
    
    // Show sensor data section
    document.getElementById('sensor-data-section').style.display = 'block';
    document.getElementById('sensor-title').innerHTML = 
        `<i class="fas fa-chart-line"></i> Данные с ${sensorName || `Датчика ${sensorId}`}`;
    
    // Update markers - keep status colors but highlight selected
    updateMarkerSelection();
    
    // Load sensor data
    loadSensorData(sensorId);
    loadSensorStatistics(sensorId);
}

// Update marker selection
function updateMarkerSelection() {
    Object.entries(sensorObjects).forEach(([sensorId, sensorObj]) => {
        const isSelected = selectedSensor == sensorId;
        const currentColor = sensorObj.marker.options.get('iconColor');
        
        sensorObj.marker.options.set({
            iconColor: currentColor, // Keep current status color
            iconImageSize: isSelected ? [30, 30] : [22, 22]
        });
    });
}

// Update sensor statuses on Yandex Map - FIXED: используем единую логику
function updateSensorStatuses(latestData) {
    for (const [sensorId, data] of Object.entries(latestData)) {
        if (!sensorObjects[sensorId]) continue;
        
        // Проверяем ВСЕ параметры по фиксированным диапазонам
        const allNormal = areAllParametersNormal(data);
        const color = allNormal ? (sensorObjects[sensorId].color || normalColor) : warningColor;
        const status = allNormal ? '🟢 Норма' : '🟠 Внимание';
        
        const marker = sensorObjects[sensorId].marker;
        
        // Update balloon content with ALL parameters
        marker.properties.set({
            balloonContent: `
                <b>${sensorObjects[sensorId].name}</b><br>
                Температура: ${data.temperature?.toFixed(1) || 'N/A'}°C<br>
                Давление: ${data.pressure?.toFixed(1) || 'N/A'} kPa<br>
                Влажность: ${data.humidity?.toFixed(1) || 'N/A'}%<br>
                Уровень CO₂: ${data.gas_composition?.toFixed(1) || 'N/A'} ppm<br>
                Уровень шума: ${data.noise_level?.toFixed(1) || 'N/A'} dB<br>
                Статус: ${status}<br>
                <small>${new Date(data.timestamp).toLocaleString('ru-RU')}</small>
            `
        });
        
        // Update color based on status, preserve selection state
        const isSelected = selectedSensor == sensorId;
        marker.options.set({
            iconColor: color,
            iconImageSize: isSelected ? [30, 30] : [22, 22]
        });
    }
}

// Обновляем блоки над графиками - используем ТУ ЖЕ ЛОГИКУ
function updateCurrentMetrics(data) {
    const metricsContainer = document.getElementById('current-metrics');
    metricsContainer.innerHTML = '';
    
    const metrics = [
        { key: 'temperature', name: 'Температура', icon: '🌡️' },
        { key: 'pressure', name: 'Давление', icon: '🌪️' },
        { key: 'humidity', name: 'Влажность', icon: '💧' },
        { key: 'gas_composition', name: 'Уровень CO₂', icon: '🌫️' },
        { key: 'noise_level', name: 'Уровень шума', icon: '📢' }
    ];
    
    metrics.forEach(metric => {
        const dataset = data.datasets.find(ds => getParameterKey(ds.label) === metric.key);
        if (dataset && dataset.data && dataset.data.length > 0) {
            const latestValue = dataset.data[0];
            const metricConfig = getMetricConfig(metric.key);
            
            // ← ВОТ ТА ЖЕ САМАЯ ПРОВЕРКА ЧТО И ДЛЯ КАРТЫ!
            const isNormal = isParameterNormal(metric.key, latestValue);
            const cardClass = isNormal ? 'border-success' : 'border-warning';
            
            const metricHTML = `
                <div class="col">
                    <div class="card ${cardClass}">
                        <div class="card-body">
                            <h5 class="card-title">${metric.icon} ${metric.name}</h5>
                            <div class="value">${latestValue.toFixed(1)}${metricConfig.unit}</div>
                            <div class="range-label" style="color: #666; font-size: 0.8rem; margin-top: 0.5rem;">диапазон нормы</div>
                            <div class="range">${metricConfig.norm_min}-${metricConfig.norm_max} ${metricConfig.unit}</div>
                        </div>
                    </div>
                </div>
            `;
            
            metricsContainer.innerHTML += metricHTML;
        }
    });
}

// Load sensor data for charts
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
            
            // ОБНОВЛЯЕМ СТАТУС НА КАРТЕ ТЕМИ ЖЕ ДАННЫМИ ЧТО И ДЛЯ ГРАФИКОВ!
            if (data.datasets && data.datasets.length > 0) {
                const latestValues = {};
                
                // Берем последние значения из графиков
                data.datasets.forEach(dataset => {
                    const paramKey = getParameterKey(dataset.label);
                    if (dataset.data && dataset.data.length > 0) {
                        latestValues[paramKey] = dataset.data[0]; // Первое значение = самое свежее
                    }
                });
                
                // Создаем объект в том же формате что и /api/latest
                const sensorLatestData = {
                    [sensorId]: {
                        temperature: latestValues.temperature || 0,
                        pressure: latestValues.pressure || 0,
                        humidity: latestValues.humidity || 0,
                        gas_composition: latestValues.gas_composition || 0,
                        noise_level: latestValues.noise_level || 0,
                        timestamp: new Date().toISOString()
                    }
                };
                
                // Обновляем только выбранный датчик на карте
                updateSingleSensorStatus(sensorLatestData);
            }
        })
        .catch(error => {
            console.error('Error loading sensor data:', error);
            showNoDataMessage();
        });
}

// Новая функция - обновляем только один датчик на карте
function updateSingleSensorStatus(sensorData) {
    for (const [sensorId, data] of Object.entries(sensorData)) {
        if (!sensorObjects[sensorId]) continue;
        
        const allNormal = areAllParametersNormal(data);
        const color = allNormal ? (sensorObjects[sensorId].color || normalColor) : warningColor;
        const status = allNormal ? '🟢 Норма' : '🟠 Внимание';
        
        const marker = sensorObjects[sensorId].marker;
        
        marker.properties.set({
            balloonContent: `
                <b>${sensorObjects[sensorId].name}</b><br>
                Температура: ${data.temperature?.toFixed(1) || 'N/A'}°C<br>
                Давление: ${data.pressure?.toFixed(1) || 'N/A'} kPa<br>
                Влажность: ${data.humidity?.toFixed(1) || 'N/A'}%<br>
                Уровень CO₂: ${data.gas_composition?.toFixed(1) || 'N/A'} ppm<br>
                Уровень шума: ${data.noise_level?.toFixed(1) || 'N/A'} dB<br>
                Статус: ${status}<br>
                <small>${new Date().toLocaleString('ru-RU')}</small>
            `
        });
        
        const isSelected = selectedSensor == sensorId;
        marker.options.set({
            iconColor: color,
            iconImageSize: isSelected ? [30, 30] : [22, 22]
        });
    }
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

// Update charts
function updateCharts(sensorData = null) {
    if (!sensorData && selectedSensor) {
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
                const colors = [
                    { border: '#0D6A77', background: 'rgba(13, 106, 119, 0.1)' },  // Темный синий
                    { border: '#4FA8B5', background: 'rgba(79, 168, 181, 0.1)' },  // Светлый синий  
                    { border: '#2E8B57', background: 'rgba(46, 139, 87, 0.1)' },   // Морской зеленый
                    { border: '#8A2BE2', background: 'rgba(138, 43, 226, 0.1)' },  // Сине-фиолетовый
                    { border: '#FF6347', background: 'rgba(255, 99, 71, 0.1)' }    // Томатный красный
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
                        text: 'Температура (°C), Влажность (%), Уровень шума (dB)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Давление (kPa), Уровень CO₂ (ppm)'
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
                    color: '#118899',
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
    let averagesHTML = '<div class="col-md-4"><div class="metric-card"><h4>📊 Средние значения за 1 час</h4>';
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
                            ${config.norm_min} - ${config.norm_max} ${config.unit}
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
                loadSystemStats();
                if (selectedSensor) {
                    loadSensorData(selectedSensor);
                    loadSensorStatistics(selectedSensor);
                }
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
                loadSystemStats();
                if (selectedSensor) {
                    loadSensorData(selectedSensor);
                    loadSensorStatistics(selectedSensor);
                }
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

function updateLimitsInfo() {
    const limitsContainer = document.getElementById('limits-container');
    
    if (!sensorConfig) {
        limitsContainer.innerHTML = '<div class="limit-item">Загрузка конфигурации...</div>';
        return;
    }
    
    let limitsHTML = '';
    
    // Порядок параметров как в конфиге
    const paramOrder = ['temperature', 'pressure', 'humidity', 'gas_composition', 'noise_level'];
    
    paramOrder.forEach(param => {
        const config = sensorConfig[param];
        if (config) {
            limitsHTML += `
                <div class="limit-item">
                    <strong><i class="fas fa-gauge-high"></i> ${config.name}:</strong><br>
                    <span>${config.norm_min} - ${config.norm_max} ${config.unit}</span>
                </div>
            `;
        }
    });
    
    limitsContainer.innerHTML = limitsHTML;
}