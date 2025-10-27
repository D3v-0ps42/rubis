#include <TroykaDHT.h>
#define DHT_PIN 8
#define DHT_TYPE DHT11
DHT dht(13, DHT11);

void setup() {
  Serial1.begin(9600);
  Serial.begin(9600);
  Serial.println("test start: ");
  dht.begin();
  pinMode(A0 ,INPUT);
  pinMode(A1 ,INPUT);
  pinMode(4,OUTPUT);
  digitalWrite(4,HIGH);
  pinMode(3,OUTPUT);
  digitalWrite(3, HIGH);
  pinMode(13, INPUT);
  Serial.println("🚀 Arduino запущен");
}

void loop() {
  dht.read();
  float pressure = 100 + random(-5,5)*0.15;
  float temperature = dht.getTemperatureC();
  float humidity = dht.getHumidity();
  float gas = readGasSensor();
  float noise = readNoiseSensor();
  
  // Проверка корректности данных
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ Ошибка чтения DHT!");
    delay(2000);
    return;
  }
  
  // Формирование строки данных
  String dataString = "TEMP:" + String(temperature, 1) + "," +
                     "HUM:" + String(humidity, 1) + "," +
                     "PRESS:" + String(pressure, 1) + "," +
                     "GAS:" + String(gas, 1) + "," +
                     "NOISE:" + String(noise, 1);
  
  // Отправка данных на ESP32
  Serial1.println(dataString);
  
  // Вывод в Serial для отладки
  Serial.print("📤 Отправлено на ESP32: ");
  Serial.println(dataString);
  
  delay(5000);
}
float readGasSensor() {
  return analogRead(A0)*3.5;
}

float readNoiseSensor() {
  return 140 - (analogRead(A1)/3);
}