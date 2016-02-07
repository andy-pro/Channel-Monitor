# Channel Monitor

System designed for monitoring channel-forming equipment in realtime and consists of:
  - Arduino Leonardo Board
  - Interface module
  - Web Server (node.js, Express, Serial lib)
  - kilometer of wires

> Maximum of scanned channels - 12.

### Version

1.0

### Commands

Use Hyper Terminal like sowtware for testing board with parameters 115200, 8N1.
```
help
Commands:
        help - this help
        ver - firmware version
        state - human readable output
        getstate - server request output
        tone [frequency] - set frequency and tone turn on, 800Hz default
        notone - tone turn off
```

```
ver
firmware version 1.0 on Arduino Leonardo
```
```
state
Frequency set to 800Hz
Channel Pin     State   Frequency
1       A5      0       0
2       A4      0       1
3       A3      0       0
4       A2      0       0
5       A1      0       2
6       A0      0       2
7       D4      0       89
8       D12     1       82
9       D6      0       87
10      D8      0       1
11      D9      0       0
12      D10     1       81
```
```
getstate
response:000000000001
```
```
tone 1000
```
```
notone
```
**UkSATSE 2016**
