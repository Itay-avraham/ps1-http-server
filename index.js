/* The Request Parser */
// Splits the raw text by line endings (aka \r\n) and extracts the method, path, and headers.
function parseRequest(rawData) {
  const requestString = rawData.toString();

  // HTTP separates the headers from the body with a double blank line (\r\n\r\n)
  const [headerSection, body] = requestString.split('\r\n\r\n');
  const lines = headerSection.split('\r\n');

  // The first line is always: METHOD PATH HTTP_VERSION
  const firstLine = lines[0].split(' ');
  const method = firstLine[0];
  let path = firstLine[1];
  const version = firstLine[2];

  // Parse the query string itself (for ex /users?id=5)
  let query = {};
  if (path && path.includes('?')) {
    const [pathPart, queryPart] = path.split('?');
    path = pathPart;
    
    // Converts the unreadable thing id=5&sort=asc into { id: '5', sort: 'asc' }
    queryPart.split('&').forEach(param => {
      const [key, value] = param.split('=');
      query[key] = decodeURIComponent(value || '');
    });
  }

  // Parses the headers into an object
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return { method, path, query, headers, body, version };
}

/* The TCP Foundation */
const net = require('net');

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    // Parses the incoming request
    const req = parseRequest(data);
    
    // Logs it to see if it worked
    console.log(`Received a ${req.method} request for ${req.path}`);
    console.log('Parsed Request Object:', req);
    
    // Sends the temporary response (for now)
    const response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nHello World!";
    socket.write(response);
    socket.end();
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});