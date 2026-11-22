const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state_data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// อ่านสถานะรีเลย์ 4 ช่องจากไฟล์
function readRelays() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ relays: [false, false, false, false] }, null, 2));
    }
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Array.isArray(data.relays) && data.relays.length === 4) {
      return data.relays;
    }
  } catch (err) {}
  return [false, false, false, false];
}

// บันทึกสถานะรีเลย์ 4 ช่องลงไฟล์
function writeRelays(relays) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ relays }, null, 2));
  } catch (err) {
    console.error(err);
  }
}

let relays = readRelays();
const server = http.createServer(app);

// สร้าง WebSocket Server แบบแยก Path (/esp และ /web)
const wssEsp = new WebSocket.Server({ noServer: true });
const wssWeb = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/esp') {
    wssEsp.handleUpgrade(request, socket, head, (ws) => {
      wssEsp.emit('connection', ws, request);
    });
  } else if (pathname === '/web') {
    wssWeb.handleUpgrade(request, socket, head, (ws) => {
      wssWeb.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ส่งข้อมูลให้ Client ทุกตัวในกลุ่ม
function broadcast(wss, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ตรวจสอบว่ามี ESP32 เชื่อมต่ออยู่หรือไม่
function isEspOnline() {
  let online = false;
  wssEsp.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) online = true;
  });
  return online;
}

// 1. จัดการการเชื่อมต่อจากบอร์ด ESP32 (/esp)
wssEsp.on('connection', (ws) => {
  console.log('[ESP32] เชื่อมต่อสำเร็จ');
  broadcast(wssWeb, { type: 'ESP_STATUS', online: true });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'GET_STATE') {
        ws.send(JSON.stringify({ type: 'INIT_STATE', relays }));
      }
    } catch (err) {}
  });

  ws.on('close', () => {
    console.log('[ESP32] ตัดการเชื่อมต่อ');
    broadcast(wssWeb, { type: 'ESP_STATUS', online: isEspOnline() });
  });
});

// 2. จัดการการเชื่อมต่อจากหน้าเว็บ (/web)
wssWeb.on('connection', (ws) => {
  // ส่งสถานะเริ่มต้นของรีเลย์ 4 ช่อง และสถานะ ESP32 ให้หน้าเว็บทันทีที่เปิด
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    relays,
    espOnline: isEspOnline()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'CONTROL') {
        const { ch, state } = data;
        if (ch >= 0 && ch < 4 && typeof state === 'boolean') {
          relays[ch] = state;
          writeRelays(relays);
          // ส่งคำสั่งไปให้ ESP32 ทันที
          broadcast(wssEsp, { type: 'CONTROL', ch, state });
          // อัปเดตหน้าเว็บทุกเครื่องที่เปิดอยู่
          broadcast(wssWeb, { type: 'STATE_UPDATE', relays });
        }
      } else if (data.type === 'CONTROL_ALL') {
        const { state } = data;
        if (typeof state === 'boolean') {
          relays = [state, state, state, state];
          writeRelays(relays);
          broadcast(wssEsp, { type: 'CONTROL_ALL', state });
          broadcast(wssWeb, { type: 'STATE_UPDATE', relays });
        }
      }
    } catch (err) {}
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
