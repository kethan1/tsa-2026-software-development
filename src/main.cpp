// Minimal Modbus RTU NPK Sensor Test (DE-only Control)

#include <Arduino.h>
#include <ModbusMaster.h>

// ——— Pin Definitions ———
// Tie the adapter’s /RE pin permanently to GND with a jumper.
// Only DE gets driven by the ESP32.
#define RS485_DE_PIN    4       // Driver-Enable
#define RX2_PIN        16       // RO → ESP32
#define TX2_PIN        17       // DI ← ESP32

// ——— Modbus Settings ———
#define MODBUS_ID       1       // default slave ID
#define NITROGEN_REG    0x001E  // register address for N (adjust if needed)

// Create Modbus object
ModbusMaster node;

// ——— RS-485 Direction Callbacks ———
void preTransmission() {
  digitalWrite(RS485_DE_PIN, HIGH);   // enable driver
  delayMicroseconds(100);              // let it settle
}
void postTransmission() {
  digitalWrite(RS485_DE_PIN, LOW);    // disable driver (enable receiver)
  delayMicroseconds(100);
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- Modbus NPK Sensor Test (DE-only) ---");

  // Configure DE pin; /RE is physically tied to GND
  pinMode(RS485_DE_PIN, OUTPUT);
  digitalWrite(RS485_DE_PIN, LOW);    

  // Start UART2 for RS-485
  Serial2.begin(9600, SERIAL_8E1 , RX2_PIN, TX2_PIN); //SERIAL_8N1: 8 data bits, no parity, 1 stop bit

  // Initialize Modbus
  node.begin(MODBUS_ID, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
             // 3 second timeout

  Serial.println("Setup complete. Entering loop…");
}

void loop() {
  // Read 1 input register (function 4)
  uint8_t result = node.readInputRegisters(NITROGEN_REG, 1);

  if (result == node.ku8MBSuccess) {
    uint16_t nitrogen = node.getResponseBuffer(0);
    Serial.print("✅ SUCCESS! Nitrogen = ");
    Serial.println(nitrogen);
  } else {
    Serial.print("⚠️ FAILED! Modbus Error Code: ");
    Serial.println(result);
    if (result == node.ku8MBResponseTimedOut) {
      Serial.println("  → Timeout (226). Check:");
      Serial.println("     • A/B wiring (swap wires)");
      Serial.println("     • Common GND among probe/MAX485/ESP32");
      Serial.println("     • Termination resistor across A–B");
    }
  }

  delay(2000);
}


/*********
  Rui Santos & Sara Santos - Random Nerd Tutorials
  Complete instructions at https://RandomNerdTutorials.com/esp32-firebase-realtime-database/
*********/
/*
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <FirebaseClient.h>

// Network and Firebase credentials
#define WIFI_SSID "2wire900"
#define WIFI_PASSWORD "Adi-3934$"

#define Web_API_KEY "AIzaSyC_0lK40t_KaHb60mSij4G3PypouL71-zc"
#define DATABASE_URL "https://tsa-soil-tester-default-rtdb.firebaseio.com/"
#define USER_EMAIL "aditya303n@gmail.com"
#define USER_PASS "WinningTSA"
#define LED 2

// User function
void processData(AsyncResult &aResult);

// Authentication
UserAuth user_auth(Web_API_KEY, USER_EMAIL, USER_PASS);

// Firebase components
FirebaseApp app;
WiFiClientSecure ssl_client;
using AsyncClient = AsyncClientClass;
AsyncClient aClient(ssl_client);
RealtimeDatabase Database;

// Timer variables for sending data every 10 seconds
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000; // 10 seconds in milliseconds

// Variables to send to the database
int intValue = 0;
float floatValue = 0.01;
String stringValue = "";

void setup(){
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  digitalWrite(LED, HIGH);
  delay(1000);
  digitalWrite(LED, LOW);
  delay(1000);


  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);

  }
  Serial.println();
  
  // Configure SSL client
  ssl_client.setInsecure();
  ssl_client.setHandshakeTimeout(5);     // Handshake timeout in seconds
  ssl_client.setTimeout(1000);           // ✅ Connection timeout in milliseconds

  
  // Initialize Firebase
  initializeApp(aClient, app, getAuth(user_auth), processData, "🔐 authTask");
  app.getApp<RealtimeDatabase>(Database);
  Database.url(DATABASE_URL);
}

void loop(){
  // Maintain authentication and async tasks
  app.loop();
  // Check if authentication is ready
  if (app.ready()){ 
    // Periodic data sending every 10 seconds
    unsigned long currentTime = millis();
    if (currentTime - lastSendTime >= sendInterval){
      // Update the last send time
      lastSendTime = currentTime;
      
      // send a string
      stringValue = "value_" + String(currentTime);
      Database.set<String>(aClient, "/test/string", stringValue, processData, "RTDB_Send_String");
      // send an int
      Database.set<int>(aClient, "/test/int", intValue, processData, "RTDB_Send_Int");
      intValue++; //increment intValue in every loop

      // send a string
      floatValue = 0.01 + random (0,100);
      Database.set<float>(aClient, "/test/float", floatValue, processData, "RTDB_Send_Float");
    }
  }
}

void processData(AsyncResult &aResult) {
  if (!aResult.isResult())
    return;

  if (aResult.isEvent())
    Firebase.printf("Event task: %s, msg: %s, code: %d\n", aResult.uid().c_str(), aResult.eventLog().message().c_str(), aResult.eventLog().code());

  if (aResult.isDebug())
    Firebase.printf("Debug task: %s, msg: %s\n", aResult.uid().c_str(), aResult.debug().c_str());

  if (aResult.isError())
    Firebase.printf("Error task: %s, msg: %s, code: %d\n", aResult.uid().c_str(), aResult.error().message().c_str(), aResult.error().code());

  if (aResult.available())
    Firebase.printf("task: %s, payload: %s\n", aResult.uid().c_str(), aResult.c_str());
}
*/
/*#include <Arduino.h>
#define LED 2
// put function declarations here:
int myFunction(int, int);

void setup() {
  Serial.begin(115200);
  Serial.println("Hello! ESP32 is starting up...");

  // put your setup code here, to run once:
  pinMode(LED, OUTPUT); // Set LED pin as output`
  Serial.println("LED pin has been initialized.");

  int result = myFunction(2, 3);
  Serial.print("Result of myFunction(2, 3): ");
  Serial.println(result);
}

void loop() {
  digitalWrite(LED, HIGH); // Turn the LED on
  Serial.println("LED ON");

  delay(500);             // Wait for a second
  digitalWrite(LED, LOW);  // Turn the LED off
  Serial.println("LED OFF");

  delay(500);             // Wait for a second
}

// put function definitions here:
int myFunction(int x, int y) {
  return x + y;
}
  */