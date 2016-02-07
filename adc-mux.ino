/*
title: Channel monitor
company: UkSATSE
autor: AndyPro
board: Arduino Leonardo
version: 1.0
 */

//#include <avr/wdt.h>

// global constants
#define FREQ 800
#define _freq_delta 5
#define _channel_cnt 12
#define _led 13
#define _gen 11
#define ADMUX_SETUP (1<<REFS0)|(1<<ADLAR) // Aref = AVcc, left align the ADC value - so we can read highest 8 bits from ADCH register only

struct Channel {
  byte mux;  
  boolean state;
  word freq;
  String pin;
};

// global vars
Channel channels[_channel_cnt];
word _freq, _fmin, _fmax;

void setup() {
  Serial.begin(115200);
  pinMode(_led, OUTPUT);  
  for (byte i=0; i < _channel_cnt; i++) {
    // mega32u4 pin: 41,40,39,38,37,36,25,26,27,28,29,30
    // port corresp: F0,F1,F4,F5,F6,F7,D4,D6,D7,B4,B5,B6
    String pin[]=  {"A5","A4","A3","A2","A1","A0","D4","D12","D6","D8","D9","D10"}; // leonardo pin names
    const byte mux[] = {0,1,4,5,6,7,32,33,34,35,36,37}; // ADMUX value
    channels[i].mux = mux[i];
    channels[i].pin = pin[i];
    channels[i].freq = 0;
  }  
  cli(); // disable interrupts
  DIDR0 = 0xF3;
  DIDR2 = 0x3F;
  ADCSRB = 0;
  ADMUX = ADMUX_SETUP;
  ADCSRA = (1<<ADEN)|(1<<ADATE)|(1<<ADIE)|(1<<ADPS2)|(1<<ADPS1); // Rrescaler div factor = 64, 16 MHz/64 = 250 kHz, 4 mcs
  ADCSRA |= (1 << ADSC); //start ADC measurements  
  freq_setup(0);  
  sei();//enable interrupts
}

ISR(ADC_vect) { //when new ADC value ready, period 4*13 = 52 mcs
  static byte newData = 0;
  static byte prevData = 0;
  static word freq = 0;
  static word sample_cnt = 0;
  static boolean state = 0;
  static byte idx=0;
  prevData = newData;//store previous value
  newData = ADCH;//get value from A0
  if ((newData > prevData) && !state) { // if increasing slope
      state = 1;
      freq++; // one period
  } else if ((newData < prevData) && state) state = 0;
  sample_cnt++;
  if (sample_cnt > 1923) { // 52*1923 = 0.1sec per channel
    sample_cnt = 0;
    if ((freq > _fmin) && (freq <= _fmax)) state = 1;
    else state = 0;
    channels[idx].freq = freq;
    channels[idx].state = state;
    idx++;
    digitalWrite(_led, LOW);
    if (idx >= _channel_cnt) {
      idx = 0;
      digitalWrite(_led, HIGH);
    }
    newData = channels[idx].mux;
    ADMUX = ADMUX_SETUP | (newData & 0x1F); // MUX4...MUX0
    ADCSRB = newData & 0x20; // MUX5
    freq = 0;
    newData = 0;
    prevData = 0;
  }
}

void freq_setup(word value) {
  if (!value) value = FREQ;
  _freq = value;
  value = value/10;
  _fmin = value - _freq_delta;
  _fmax = value + _freq_delta;
  tone(_gen, _freq);
}

void loop() {
  static String cmd = "";
  while (Serial.available() > 0) {
    //wdt_reset(); // WatchDog reset
    char recieved = Serial.read();
    Serial.print(recieved);
    if (recieved == '\r') { // \r=13, \n=10
      Serial.println();
      
      if (cmd == "state") {
        Serial.println("Frequency set to " + String(_freq, DEC) + "Hz");          
        Serial.println("Channel\tPin\tState\tFrequency");  
        for (byte i=0; i < _channel_cnt; i++) {
          Serial.println(String(i+1, DEC) + "\t" + channels[i].pin + "\t" + String(channels[i].state, DEC) + "\t" + String(channels[i].freq, DEC));
        }          
      } else
                    
      if (cmd == "getstate") {
        Serial.print("response:");
        for (byte i=0; i < _channel_cnt; i++) {
          Serial.print(channels[i].state, DEC);
        }
        Serial.println();                 
      } else
                          
      if (cmd.startsWith("tone")) {
        word val = cmd.substring(5).toInt();
        freq_setup(val);
      } else
          
      if (cmd == "notone") {
        noTone(_gen);
        _freq = 0;
      } else
          
      if (cmd == "help") {
        Serial.println("Commands:"
          "\r\n\thelp - this help"
          "\r\n\tver - firmware version"
          "\r\n\tstate - human readable output"
          "\r\n\tgetstate - server request output"
          "\r\n\ttone [frequency] - set frequency and tone turn on, 800Hz default"
          "\r\n\tnotone - tone turn off");
      } else
      
      if (cmd == "ver") {
        Serial.println("firmware version 1.0 on Arduino Leonardo");
      } else

      if (cmd != "") Serial.println("no such command");      
      cmd = ""; // Clear recieved buffer

    } else cmd += recieved;         
  }
}

