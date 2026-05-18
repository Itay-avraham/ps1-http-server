/* Response Builder Function */
// Wraps the raw TCP socket with some accessible methods 
function createResponse(socket) {
  let statusCode = 200;
  let statusText = 'OK';
  const headers = {};

  return {
    // Allows setting custom status codes
    status(code) {
      statusCode = code;
      const statusTexts = {
        200: 'OK', 201: 'Created', 400: 'Bad Request',
        403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error'
      };
      statusText = statusTexts[code] || 'Unknown';
      return this; // for chaining
    },

    // Allows setting custom headers
    set(key, value) {
      headers[key] = value;
      return this;
    },

    // Sends plain text or HTML
    send(text) {
      // Default to text/plain if no content type was set
      headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
      
      // Calculates the actual byte size (which I've read is safer than text.length)
      headers['Content-Length'] = Buffer.byteLength(text);

      // Builds the HTTP response string
      let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;
      for (const [k, v] of Object.entries(headers)) {
        response += `${k}: ${v}\r\n`;
      }
      response += '\r\n' + text;
      
      socket.write(response);
      socket.end();
    },

    // Converts an object to JSON and sends it
    json(data) {
      const body = JSON.stringify(data);
      this.set('Content-Type', 'application/json');
      this.send(body);
    }
  };
}

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
    const req = parseRequest(data);
    const res = createResponse(socket); // Initializes the response builder
    
    console.log(`Received a ${req.method} request for ${req.path}`);
    
    // Simple manual routing test
    if (req.path === '/api/info') {
      res.status(200).json({ 
        message: 'Server is running', 
        version: '1.0',
        youAskedFor: req.query 
      });
    } else {
      res.status(404).send('Error 404: Page not found');
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});