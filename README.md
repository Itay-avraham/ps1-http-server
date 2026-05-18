# Custom Node.js HTTP Server Framework
This project is a custom-built HTTP web framework created from the ground-up. 
It uses Node.js's low-level `net` module to handle raw TCP connections, manually parsing HTTP/1.1 requests and constructing
valid HTTP/1.1 responses without relying on the built-in `http` module or any third-party libraries.

## API Design Choices
I tried designing this API to mirror the clean and chainable developer experience of Express.js.
Instead of a massive `if/else` block handling raw strings, developers can instantiate a router and use familiar methods:

* **The Router:** Uses `app.get()` and `app.post()` for clean route definitions. Supports dynamic URL parameters (for example, `/users/:id`) by 
converting path strings into Regex.
* **The Response Object (`res`):** Wraps the raw socket to provide chainable methods like `res.status(200).json(...)`.
Automatically calculates `Content-Length` (by using `Buffer.byteLength`) and assigns proper MIME types to prevent tedious manual header management.

## Creative Features
I decided to implement three unique custom features (because I thought they'd be cool to have):
1. **Automated Colorful Logging:** This built-in terminal logger intercepts every outgoing response and prints a color-coded summary
(Green for 200s, Yellow for 300s, Red for 400s/500s). This makes debugging and monitoring network traffic easier and more intuitive. It also
feels rewarding I'd say, to see everything go green (or red if you're evil enough).
2. **Basic Template Engine:** The `res.render()` method reads HTML files and injects dynamic server-side variables
(by using `{{variable}}` syntax) before sending the final parsed HTML to the client.
3. **Custom 404 Page:** Instead of dropping a plain boring text string for broken links, the server's fallback router
automatically serves a custom-styled, terminal-themed `404.html` page. Because if things break, at least they look cool while doing it.

## Example Usage

### 1. Setting up a basic route
```javascript
app.get('/api/info', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    routed: true 
  });
});
```

### 2. Serving Static Files 
```javascript
// Automatically detects the MIME type and serves the file from the /public directory
app.get('/public/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.params.filename);
  res.sendFile(filePath);
});
```

### 3. Using the Template Engine
```javascript
// Renders profile.html and injects the dynamic data object
app.get('/profile', (req, res) => {
  const templatePath = path.join(__dirname, 'views', 'profile.html');
  res.render(templatePath, {
    name: 'Itay',
    level: 'Administrator',
    statusMessage: 'All systems operational.'
  });
});
```