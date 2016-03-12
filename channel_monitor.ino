/*
 * Channel Monitor
 * Created: 2/8/2016 8:21:30 PM
 * Author: AndyPro
 * Company: UkSATSE
 * Board: Arduino Leonardo
 * Version: 1.1
 */ 

#include <EEPROM.h>
#include <avr/wdt.h>
#include "tm.h"

// global constants
#define FREQ 800
#define _speed 115200
#define _squelch 10 /* 70-80 for meandr */
#define _freq_delta 5
#define _channel_cnt 12
#define _EE_MASK_ADDR 0
#define _MASK 0xFFF

#define _btn 7
#define _gen 11
// Aref = Internal 2.56V Reference, left align the ADC value - read ADCH only
#define ADMUX_SETUP (1<<REFS1)|(1<<REFS0)|(1<<ADLAR) 

#define _buzzer 3
#define _led 13

struct Channel {
  String pin;
  String conn;
  byte mux;
  boolean state;
  word freq;
};

// global vars
Channel channels[_channel_cnt];
word _freq, _fmin, _fmax, raw_state, masked_state, mask;
byte alarmingChannel;
boolean alarm = false;

void setupFreq(word value) {
  if (!value) value = FREQ;
  _freq = value;
  value = value/10;
  _fmin = value - _freq_delta;
  _fmax = value + _freq_delta;
  tone(_gen, _freq);
  digitalWrite(_buzzer, LOW);
}

void resetAlarm(boolean start) {
  int _pl[] = {1, 11, 0, 0, -1};
  tmProg(_led, _pl, 5); // 0.1s on, 1.1s off, infinity
  if (start) testAlarm();
  else {
    int _pb[] = {0}; 
    tmProg(_buzzer, _pb, 1);   
  } 
}

void testAlarm() {
  int _pb[]  = {1, 1, 2, 0, 0};
  tmProg(_buzzer, _pb, 5);
}

void printState() {
  Serial.println("Frequency set to " + String(_freq, DEC) + "Hz");
  if (alarmingChannel) Serial.println("Alarm! Channel: " + String(alarmingChannel, DEC));
  Serial.println("Channel\tConn\tPin\tState\tMask\tFrequency"); 
  word m = mask;
  boolean mp;
  for (byte i=0; i < _channel_cnt; i++) {
    Channel c = channels[i];
    if (m&0x800) mp = 1;
    else mp = 0;
    m = m << 1;
    Serial.println(String(i+1, DEC)+"\t"+c.conn+"\t"+c.pin+"\t"+String(c.state, DEC)+"\t"+String(mp, DEC)+"\t"+String(c.freq, DEC));
  } 
}

void setup() {
  Serial.begin(_speed);
  cli(); // disable interrupts
  pinMode(_buzzer, OUTPUT); 
  pinMode(_btn, INPUT_PULLUP); 
  pinMode(_led, OUTPUT); 
  setupFreq(0); 
  EEPROM.get(_EE_MASK_ADDR, mask); 
  /* 
   * channel structures setup  
   * mega32u4 pin: 41,40,39,38,37,36,25,26,27,28,29,30
   * port corresp: F0,F1,F4,F5,F6,F7,D4,D6,D7,B4,B5,B6 
   */
  String _pin[]=  { "A5",  "A4",  "A3",  "A2",  "A1",  "A0",  "A6",  "A7",  "A8",  "A9",  "A10", "A11"}; // leonardo pin names
  String _conn[]=  {"X1/3","X1/5","X1/7","X1/8","X1/6","X1/4","X2/4","X2/3","X2/6","X2/8","X2/7","X2/5"}; // connectors RJ-45
  byte _mux[] = {0,1,4,5,6,7,32,33,34,35,36,37}; // ADMUX value
  for (byte i=0; i < _channel_cnt; i++) {
    channels[i].pin = _pin[i];
    channels[i].conn = _conn[i];
    channels[i].mux = _mux[i];
    channels[i].freq = 0;
  }
  /* ADC setup */
  DIDR0 = 0xF3;
  DIDR2 = 0x3F;
  ADCSRB = 0;
  ADMUX = ADMUX_SETUP;
  ADCSRA = (1<<ADEN)|(1<<ADATE)|(1<<ADIE)|(1<<ADPS2)|(1<<ADPS1); // Rrescaler div factor = 64, 16 MHz/64 = 250 kHz, 4 mcs
  ADCSRA |= (1 << ADSC); //start ADC measurements  
  sei();//enable interrupts
  /* task manager setup */
  byte tmpins[] = {_led, _buzzer};
  tmSetup(tmpins); // id=0 led, id=1 buzzer
  /* led & buzzer init */  
  resetAlarm(true);
}

ISR(ADC_vect) { //when new ADC value ready, period 4*13 = 52 mcs
  
  static byte idx = 0;
  static byte newData = 0;
  static byte prevData = 0;
  static word freq = 0;
  static word sample_cnt = 0;
  static boolean state = false;
  static word prevState = _MASK;  
  static word raw = 0;

  if (!digitalRead(_btn) && alarm) {
    digitalWrite(_buzzer, HIGH);
    //while (!digitalRead(_btn)) {}
    resetAlarm(false);
    alarm = false;   
  }
    
  prevData = newData;//store previous value
  newData = ADCH;//get value from A0
  if (((newData-prevData) > _squelch) && !state) { // if increasing slope
    /* for debug  
     * Serial.println(String(idx, DEC)+" inc "+String(newData-prevData, DEC));
     */
    state = true;
    freq++; // one period
  } else if (((prevData-newData) > _squelch) && state) {
    state = false;
    /* for debug  
     *Serial.println(String(idx, DEC)+" dec "+String(prevData-newData, DEC));
     */
  }
  sample_cnt++;
  if (sample_cnt > 1923) { 
    /* 52*1923 = 0.1sec tick */ 
    /* ADC channel scanner proc */
    sample_cnt = 0;
    if ((freq > _fmin) && (freq <= _fmax)) state = 1;
    else state = 0;
    channels[idx].freq = freq;
    channels[idx].state = state;
    raw = raw << 1;
    raw = raw | state;
    idx++;    
    if (idx >= _channel_cnt) {
      raw_state = raw & _MASK;
      raw = raw_state | mask;
      masked_state = raw;
      alarmingChannel = 0; 
      for (byte i=0; i < _channel_cnt; i++) { // find first fault channel
        if (!(raw & 0x800)) { // 0 - alarm, 1 - normal
          alarmingChannel = i+1;
          break;
        }
        raw = raw << 1;
      }
      if (alarmingChannel && (prevState != masked_state)) {
        //printState();
        int ap[] = {10, 10, 0, 20, 0, 1, 4, alarmingChannel-1, 30, -1};
        tmProg(_led, ap, 10);
        tmProg(_buzzer, ap, 10);
        alarm = true;
      }
      prevState = masked_state;            
      idx = 0;
    }
    newData = channels[idx].mux;
    ADMUX = ADMUX_SETUP | (newData & 0x1F); // MUX4...MUX0
    ADCSRB = newData & 0x20; // MUX5
    freq = 0;
    newData = 0;
    prevData = 0;
    /* Task manager proc */
    tmNext();
  }
}

void loop() {
  static String cmd = "";
  while (Serial.available() > 0) {
    //wdt_reset(); // WatchDog reset
    word val;
    char recieved = Serial.read();
    Serial.print(recieved);
    if (recieved == '\r') { // \r=13, \n=10
      Serial.println();
      
      if (cmd == "state") {
        printState();
      } else
                    
      if (cmd == "getstate") {
        Serial.println("query?raw=" + String(raw_state, DEC) + "&mask=" + String(mask, DEC));                
      } else

      if (cmd.startsWith("setmask")) {
        mask = cmd.substring(8).toInt() & _MASK;
        EEPROM.put(_EE_MASK_ADDR, mask);
      } else

      if (cmd == "alm") {
        testAlarm();
      } else      

      if (cmd.startsWith("tone")) {
        val = cmd.substring(5).toInt();
        setupFreq(val);
      } else
        
      if (cmd == "notone") {
        noTone(_gen);
        _freq = 0;
      } else
                          
      if (cmd.startsWith("tms")) { // 0, 1
        byte id = cmd.substring(4).toInt();        
        tmSendState(id);
      } else
                                  
      if (cmd.startsWith("tm")) {
        int ptrn[5];
        byte ch = cmd.substring(3,5).toInt(); // 13, 03
        ptrn[0]  = cmd.substring(6,8).toInt();
        ptrn[1]  = cmd.substring(9,11).toInt();
        ptrn[2]  = cmd.substring(12,14).toInt();
        ptrn[3]  = cmd.substring(15,17).toInt();
        ptrn[4]  = cmd.substring(18).toInt();
        tmProg(ch, ptrn, 5);
      } else
   
      if (cmd == "help") {
        Serial.println("Commands:"
          "\r\n\thelp - this help"
          "\r\n\tver - firmware version"
          "\r\n\tstate - human readable output"
          "\r\n\tgetstate - server request output"
          "\r\n\tsetmask mask - set mask on scanned channels, decimal, 1 ch - MSB, ..., 12 ch - LSB"
          "\r\n\ttm pin xx xx xx xx xx - task manager pattern E D N P K"
          "\r\n\ttms index - task manager state for given record"
          "\r\n\talm - test alarm"
          "\r\n\ttone [frequency] - set frequency and tone turn on, 800Hz default"
          "\r\n\tnotone - tone turn off");
      } else
      
      if (cmd == "ver") {
        Serial.println("firmware version 1.1 on Arduino Leonardo");
      } else

      if (cmd != "") Serial.println("no such command");      
      cmd = ""; // Clear recieved buffer

      Serial.println();

    } else cmd += recieved;         
  }
}

