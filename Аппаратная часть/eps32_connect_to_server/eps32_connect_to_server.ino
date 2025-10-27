#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ========== НАСТРОЙКИ WiFi ==========
const char* ssid = "-_-";           // ЗАМЕНИТЕ на имя вашей WiFi сети
const char* password = "b0ber1en0t";   // ЗАМЕНИТЕ на пароль от WiFi

// URL вашего сервера Flask
// ЗАМЕНИТЕ YOUR_SERVER_IP на IP-адрес вашего сервера
const char* serverURL = "http://217.26.26.154:5000/api/esp32_data";

// ========== НАСТРОЙКИ Serial2 ==========
#define RXD2 16  // GPIO16 → TX Arduino
#define TXD2 17  // GPIO17 → RX Arduino

// Буфер для данных от Arduino
String serialBuffer = "";
unsigned long lastDataTime = 0;
const unsigned long DATA_TIMEOUT = 10000; // 10 секунд таймаут

// Структура для хранения данных с датчиков
struct SensorData {
  float temperature = 0.0;
  float pressure = 0.0;
  float humidity = 0.0;
  float gas_composition = 0.0;
  float noise_level = 0.0;
  bool dataReceived = false;
};

SensorData currentData;

void setup() {
  // Инициализация Serial для отладки
  Serial.begin(115200);
  
  // Инициализация Serial2 для связи с Arduino
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  
  Serial.println("🚀 ESP32 запущен");
  Serial.println("📡 Ожидание данных от Arduino...");
  
  // Подключение к WiFi
  connectToWiFi();
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.println("📶 Подключение к WiFi...");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Подключено к WiFi!");
    Serial.print("📡 IP адрес: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Ошибка подключения к WiFi!");
  }
}

void loop() {
  // Чтение данных от Arduino
  readFromArduino();
  
  // Проверка таймаута данных
  if (currentData.dataReceived && millis() - lastDataTime > DATA_TIMEOUT) {
    Serial.println("⚠️ Данные устарели, сброс...");
    currentData.dataReceived = false;
  }
  
  // Отправка данных на сервер если есть новые данные
  if (currentData.dataReceived) {
    sendSensorData();
    currentData.dataReceived = false; // Сбрасываем флаг после отправки
  }
  
  // Переподключение к WiFi если необходимо
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi отключен! Переподключаемся...");
    connectToWiFi();
  }
  
  delay(1000); // Задержка между циклами
}

void readFromArduino() {
  // Чтение данных из Serial2
  while (Serial2.available()) {
    char c = Serial2.read();
    
    if (c == '\n') {
      // Конец строки - обрабатываем данные
      processSerialData(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') {
      // Добавляем символ в буфер (игнорируем \r)
      serialBuffer += c;
    }
  }
}

void processSerialData(String data) {
  data.trim(); // Убираем пробелы
  
  if (data.length() == 0) return;
  
  Serial.print("📨 Получено от Arduino: ");
  Serial.println(data);
  
  // Ожидаемый формат от Arduino: 
  // "TEMP:23.5,HUM:45.0,PRESS:101.3,GAS:450.0,NOISE:35.0"
  
  // Разбиваем строку на части
  int startIndex = 0;
  int endIndex = data.indexOf(',');
  
  while (endIndex != -1) {
    String pair = data.substring(startIndex, endIndex);
    processDataPair(pair);
    
    startIndex = endIndex + 1;
    endIndex = data.indexOf(',', startIndex);
  }
  
  // Обрабатываем последнюю пару
  String lastPair = data.substring(startIndex);
  processDataPair(lastPair);
  
  // Обновляем время получения данных
  lastDataTime = millis();
  currentData.dataReceived = true;
  
  Serial.println("✅ Данные от Arduino обработаны");
  printCurrentData();
}

void processDataPair(String pair) {
  // Формат: "KEY:VALUE"
  int separatorIndex = pair.indexOf(':');
  
  if (separatorIndex == -1) return;
  
  String key = pair.substring(0, separatorIndex);
  String valueStr = pair.substring(separatorIndex + 1);
  float value = valueStr.toFloat();
  
  // Сохраняем данные в структуру
  if (key == "TEMP") {
    currentData.temperature = value;
  } else if (key == "HUM") {
    currentData.humidity = value;
  } else if (key == "PRESS") {
    currentData.pressure = value;
  } else if (key == "GAS") {
    currentData.gas_composition = value;
  } else if (key == "NOISE") {
    currentData.noise_level = value;
  }
}

void printCurrentData() {
  Serial.println("📊 Текущие данные:");
  Serial.print("  🌡️ Температура: "); Serial.print(currentData.temperature); Serial.println("°C");
  Serial.print("  💧 Влажность: "); Serial.print(currentData.humidity); Serial.println("%");
  Serial.print("  📊 Давление: "); Serial.print(currentData.pressure); Serial.println(" kPa");
  Serial.print("  🌫️ Уровень CO₂: "); Serial.print(currentData.gas_composition); Serial.println(" ppm");
  Serial.print("  🔊 Уровень шума: "); Serial.print(currentData.noise_level); Serial.println(" dB");
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Нет подключения к WiFi!");
    return;
  }
  
  HTTPClient http;
  
  // Начинаем HTTP соединение
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  
  // Создаем JSON объект
  DynamicJsonDocument doc(512);
  doc["temperature"] = round(currentData.temperature * 10) / 10.0;
  doc["pressure"] = round(currentData.pressure * 10) / 10.0;
  doc["humidity"] = round(currentData.humidity * 10) / 10.0;
  doc["gas_composition"] = round(currentData.gas_composition * 10) / 10.0;
  doc["noise_level"] = round(currentData.noise_level * 10) / 10.0;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("📤 Отправка данных на сервер:");
  Serial.println(jsonString);
  
  // Отправляем POST запрос
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("✅ Ответ сервера: ");
    Serial.println(httpResponseCode);
    
    DynamicJsonDocument resDoc(256);
    deserializeJson(resDoc, response);
    
    if (resDoc["success"] == true) {
      Serial.println("✅ Данные успешно сохранены на сервере!");
    } else {
      Serial.print("❌ Ошибка сервера: ");
      Serial.println(resDoc["error"].as<String>());
    }
  } else {
    Serial.print("❌ Ошибка HTTP запроса: ");
    Serial.println(httpResponseCode);
    Serial.print("❌ Ошибка: ");
    Serial.println(http.errorToString(httpResponseCode));
  }
  
  // Закрываем соединение
  http.end();
}