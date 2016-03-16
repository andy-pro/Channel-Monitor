/* ===== Task manager ===== */

/* Task manager defines */

#define PATTERN_PINS_CNT 2
#define PATTERN_MAX 4

struct Pattern {
  byte pin;
  int pvar[5]; /* variable pattern */
  int pconst[PATTERN_MAX*5]; /* constant pattern */
};

/* Task manager implementation */

Pattern patterns[PATTERN_PINS_CNT];

void tmSetup(byte pins[]) {
  for(byte i=0; i<PATTERN_PINS_CNT; i++)
    patterns[i].pin = pins[i];
}

void tmSendState(byte id) { /* for debug */
  Pattern v = patterns[id];
  Serial.print("Task manager state for pin " + String(v.pin, DEC) + "\nvariable pattern\n");
  for (byte j=0; j<5; j++) Serial.print(String(v.pvar[j], DEC) + "\t");
  Serial.print("\nconstant pattern\n");
  for (byte j=0; j<PATTERN_MAX; j++) {
    for (byte k=0; k<5; k++) Serial.print(String(v.pconst[j*5+k], DEC) + "\t");
    Serial.print("\n");
  }
  Serial.println();
}

byte tmFindId(byte pin) {
  for(byte i=0; i<PATTERN_PINS_CNT; i++)
    if (patterns[i].pin == pin) return i;
}

void tmProg(byte pin, int pattern[], byte size) {
/*
  pin - Arduino pin
  pattern: E [D N P K]
    E - ticks for pin enable
    D - ticks for pin disable
    N - the number of cycles E, D
    P - pause
    K - the number of cycles E, D, N, P. Infinity, if eq. -1.
    Number of patterns - see PATTERN_MAX
  size - size of pattern
  ======================
  tick = 0.1s
*/
  byte id = tmFindId(pin);
  int v;
  for (byte i=0; i<PATTERN_MAX*5; i++) {
    if (i<size)
      v = pattern[i];
    else
      v = 0;
    patterns[id].pconst[i] = v;  
    if (i<5) patterns[id].pvar[i] = v;
  }
  // tmSendState(id);
}

void tmShift(byte id) {
  int v;
  for (byte i=0; i<(PATTERN_MAX)*5; i++) {
    if (i<(PATTERN_MAX-1)*5) {
      v = patterns[id].pconst[i+5];
      patterns[id].pconst[i] = v;
      if (i<5) patterns[id].pvar[i] = v;
    } else patterns[id].pconst[i] = 0;
  }
}

void tmRenewN(byte id) {
  patterns[id].pvar[0] = patterns[id].pconst[0];
  patterns[id].pvar[1] = patterns[id].pconst[1];
}

void tmRenewK(byte id) {
  patterns[id].pvar[2] = patterns[id].pconst[2];
  patterns[id].pvar[3] = patterns[id].pconst[3];  
  tmRenewN(id);
}

void tmNext() {
  for(byte i=0; i<PATTERN_PINS_CNT; i++) {
    Pattern v = patterns[i];
    int f = v.pvar[0]; // E
    if (f) {
      patterns[i].pvar[0] = f-1; // E-1
      digitalWrite(v.pin, HIGH);
    } else {
      digitalWrite(v.pin, LOW);
      f = v.pvar[1]; // D
      if (f) patterns[i].pvar[1] = f-1; // D-1
      else {
        f = v.pvar[2]; // N
        if (f) {
          patterns[i].pvar[2] = f-1; // N-1
          tmRenewN(i);
        }
        else {
          f = v.pvar[3]; // P
          if (f) patterns[i].pvar[3] = f-1; // P-1
          else {
            f = v.pvar[4]; // K
            if (!f) tmShift(i);
            else {
              if (f != -1) patterns[i].pvar[4] = f-1; // K-1
              tmRenewK(i);
            }
          }
        }
      }
    }
  }
}

/* end task manager */

