
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// ให้เซิร์ฟเวอร์แสดงไฟล์หน้าเว็บ (index.html และ house.jpg) ในโฟลเดอร์นี้
app.use(express.static(__dirname));

// ตัวแปรเก็บสถานะหลอดไฟล่าสุด (เริ่มต้นที่ปิด = "OFF")
let lightState = "OFF";

// 1. API สำหรับหน้าเว็บและ ESP32 ดึงสถานะไฟปัจจุบัน
app.get('/api/status', (req, res) => {
  res.json({ status: lightState });
});

// 2. API สำหรับหน้าเว็บส่งคำสั่งเปิด-ปิดไฟ
app.post('/api/control', (req, res) => {
  const { status } = req.body;
  if (status === "ON" || status === "OFF") {
    lightState = status;
    console.log(`Light status changed to: ${lightState}`);
    res.json({ success: true, status: lightState });
  } else {
    res.status(400).json({ success: false, message: "Invalid status" });
  }
});

// หน้าหลักเปิดไฟล์ index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Home Server running on port ${PORT}`);
});
