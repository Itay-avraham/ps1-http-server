// This is our TCP Foundation.

const net = require('net');

const server = net.createServer((socket) => {
  // Listen for incoming data from the client
  socket.on('data', (data) => {
    const rawRequest = data.toString();
    console.log("--- Incoming Request ---");
    console.log(rawRequest);
    
    // Send a hardcoded valid HTTP/1.1 response to verify the connection works
    const response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nHello World!";
    socket.write(response);
    socket.end(); // Close the connection
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});