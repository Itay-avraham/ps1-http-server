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

/* Router Creation */
// Register routes using .get() and .post() and when a request comes in the router 
// searches its lists to find the correct matching function. I
function createRouter() {
  // Storing the route handlers categorized by HTTP method
  const routes = {
    GET: [],
    POST: [],
    PUT: [],
    DELETE: []
  };

  // Registers a new route
  function addRoute(method, path, handler) {
    const paramNames = [];
    
    // regex convertation (path -> regex)
    const regexPath = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)'; 
    });

    routes[method].push({
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      handler
    });
  }

  // Evaluates an incoming request against registered routes
  function handle(req, res) {
    const methodRoutes = routes[req.method] || [];

    for (const route of methodRoutes) {
      const match = req.path.match(route.regex);
      
      if (match) {
        // extract any parameters from the URL if there is a match
        req.params = {};
        route.paramNames.forEach((name, index) => {
          req.params[name] = match[index + 1];
        });
        
        // developer's callback function
        return route.handler(req, res);
      }
    }
    
    // If the loop finishes without returning it must mean that no route matched
    res.status(404).send('Error 404: Route not defined in router');
  }

  return {
    get: (path, handler) => addRoute('GET', path, handler),
    post: (path, handler) => addRoute('POST', path, handler),
    handle // Expose the handle function so the TCP server can use it
  };
}

/* The TCP Foundation */
const net = require('net');

// Initializing the router and defining routes (Express-like API)
const app = createRouter();
app.get('/api/info', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    routed: true 
  });
});

app.get('/users/:id', (req, res) => {
  // This testing the dynamic parameter extraction
  res.status(200).send(`You are looking at the profile for user ID: ${req.params.id}`);
});

app.post('/api/data', (req, res) => {
  res.status(201).send('Data received via POST request');
});

// Creating the server
const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const req = parseRequest(data);
    const res = createResponse(socket);   
    console.log(`[Router] Routing ${req.method} request to ${req.path}`);
    app.handle(req, res);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});