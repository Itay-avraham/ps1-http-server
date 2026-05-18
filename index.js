/* built-in modules */
const fs = require('fs');
const path = require('path');

/* Response Builder Function */
// Wraps the raw TCP socket with some accessible methods 
// To make things unique and cool we also use Terminal colors to 
// prints a color-coded summary of what just happened :)
function createResponse(socket, req) {
  let statusCode = 200;
  let statusText = 'OK';
  const headers = {};

  // Internal Logging Function (Terminal Colors)
  const logRequest = () => {
    const timestamp = new Date().toLocaleTimeString();
    let color = '\x1b[32m'; // Default to Green for 200s (because green is cool)
    
    if (statusCode >= 400) {
      color = '\x1b[31m'; // Red for errors (because red is... bad? but also cool)
    } else if (statusCode >= 300) {
      color = '\x1b[33m'; // Yellow for redirects (because yellow is also cool)
    }

    const reset = '\x1b[0m'; // and now resets terminal color back to normal
    
    console.log(`[${timestamp}] ${color}${statusCode} ${statusText}${reset} | ${req.method} ${req.path}`);
  };

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
      headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
      headers['Content-Length'] = Buffer.byteLength(text);

      let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;
      for (const [k, v] of Object.entries(headers)) {
        response += `${k}: ${v}\r\n`;
      }
      response += '\r\n' + text;
      
      socket.write(response);
      logRequest();
      socket.end();
    },

    // Converts an object to JSON and sends it
    json(data) {
      const body = JSON.stringify(data);
      this.set('Content-Type', 'application/json');
      this.send(body);
    },

    // Reads a file from the disk and sends it to the client
    sendFile(filePath) {
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.json': 'application/json',
        '.txt': 'text/plain'
      };

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      fs.readFile(filePath, (err, fileData) => {
        if (err) {
          this.status(404).send('404: File not found on server');
          return;
        }

        this.set('Content-Type', contentType);
        this.set('Content-Length', Buffer.byteLength(fileData));

        let responseHeader = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;
        for (const [k, v] of Object.entries(headers)) {
          responseHeader += `${k}: ${v}\r\n`;
        }
        responseHeader += '\r\n';

        socket.write(responseHeader);
        socket.write(fileData); 
        logRequest();
        socket.end();
      });
    },

    // Reads an HTML file, replaces {{variables}} and sends the dynamic HTML
    render(filePath, dataObj) {
      fs.readFile(filePath, 'utf8', (err, htmlString) => {
        if (err) {
          this.status(404).send('404: Template not found');
          return;
        }

        let finalHtml = htmlString.replace(/{{(.*?)}}/g, (match, variableName) => {
          const key = variableName.trim();
          return dataObj[key] !== undefined ? dataObj[key] : '';
        });

        this.set('Content-Type', 'text/html');
        this.send(finalHtml);
      });
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
    
    // If the loop finishes without returning, no route matched
    const errorPagePath = path.join(__dirname, 'views', '404.html');
    res.status(404).sendFile(errorPagePath);
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
  // This is testing the dynamic parameter extraction
  res.status(200).send(`You are looking at the profile for user ID: ${req.params.id}`);
});

// Route for static files
app.get('/public/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.params.filename);
  res.sendFile(filePath);
});

app.get('/profile', (req, res) => {
  const templatePath = path.join(__dirname, 'views', 'profile.html');
  
  res.render(templatePath, {
    name: 'Itay',
    level: 'Administrator',
    statusMessage: 'All systems operational.'
  });
});

app.post('/api/data', (req, res) => {
  res.status(201).send('Data received via POST request');
});

// Creating the server
const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const req = parseRequest(data);
    const res = createResponse(socket, req);  
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