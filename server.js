const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state_data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ status: "OFF" }, null, 2));
    }
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data).status || "OFF";
  } catch (err) {
    return "OFF";
  }
}

function writeState(newStatus) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ status: newStatus }, null, 2));
  } catch (err) {
    console.error(err);
  }
}

app.get('/api/status', (req, res) => {
  res.json({ status: readState() });
});

app.post('/api/control', (req, res) => {
  const { status } = req.body;
  if (status === "ON" || status === "OFF") {
    writeState(status);
    res.json({ success: true, status: status });
  } else {
    res.status(400).json({ success: false });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
