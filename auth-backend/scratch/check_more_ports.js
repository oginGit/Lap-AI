const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

async function run() {
  const activePorts = [];
  // Scan common ports
  const commonPorts = [3000, 3001, 3002, 5000, 5050, 5051, 5052, 5173, 5174, 8000, 8080];
  for (const port of commonPorts) {
    const active = await checkPort(port);
    if (active) {
      activePorts.push(port);
    }
  }
  console.log('Active ports:', activePorts);
}

run();
