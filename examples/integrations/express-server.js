#!/usr/bin/env node

/**
 * Express Server Integration Example
 *
 * This example demonstrates how to integrate agent-stream-fmt with Express.js
 * to build web applications that serve formatted AI agent outputs. It shows:
 *
 * 1. Real-time streaming endpoints
 * 2. WebSocket integration for live updates
 * 3. HTML report generation
 * 4. API endpoints for programmatic access
 * 5. File upload and processing
 *
 * Prerequisites:
 *   npm install express ws multer
 *
 * Run this example:
 *   node examples/integrations/express-server.js
 *
 * Then visit: http://localhost:3000
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { createReadStream, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Readable } from 'stream';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check for required dependencies
try {
  await import('ws');
} catch (error) {
  console.error('Missing dependency: ws');
  console.error('Install with: npm install ws');
  process.exit(1);
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory storage for demo (use a database in production)
const sessions = new Map();
let sessionCounter = 0;

/**
 * WebSocket connection handling for real-time streaming
 */
wss.on('connection', ws => {
  console.log('WebSocket client connected');

  ws.on('message', async message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'stream' && data.jsonl) {
        console.log('Streaming JSONL data via WebSocket...');

        const input = Readable.from([data.jsonl]);
        const vendor = data.vendor || 'auto';

        ws.send(
          JSON.stringify({
            type: 'stream_start',
            vendor: vendor,
          }),
        );

        try {
          for await (const formatted of streamFormat({
            vendor: vendor,
            source: input,
            format: 'ansi',
            hideDebug: data.hideDebug || false,
            collapseTools: data.collapseTools || false,
          })) {
            ws.send(
              JSON.stringify({
                type: 'stream_data',
                data: formatted,
              }),
            );
          }

          ws.send(
            JSON.stringify({
              type: 'stream_end',
            }),
          );
        } catch (streamError) {
          ws.send(
            JSON.stringify({
              type: 'stream_error',
              error: streamError.message,
            }),
          );
        }
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: error.message,
        }),
      );
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

/**
 * API Routes
 */

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'agent-stream-fmt-server',
    timestamp: new Date().toISOString(),
  });
});

// Stream JSONL data and return formatted output
app.post('/api/stream', async (req, res) => {
  try {
    const { jsonl, vendor = 'auto', format = 'ansi', options = {} } = req.body;

    if (!jsonl) {
      return res.status(400).json({ error: 'Missing jsonl data' });
    }

    const input = Readable.from([jsonl]);
    const results = [];

    // Set appropriate content type
    switch (format) {
      case 'html':
        res.setHeader('Content-Type', 'text/html');
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        break;
      default:
        res.setHeader('Content-Type', 'text/plain');
    }

    // Stream the formatted output
    for await (const formatted of streamFormat({
      vendor,
      source: input,
      format,
      ...options,
    })) {
      if (format === 'json') {
        results.push(formatted);
      } else {
        res.write(formatted);
      }
    }

    if (format === 'json') {
      res.json(results);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze JSONL data and return metrics
app.post('/api/analyze', async (req, res) => {
  try {
    const { jsonl, vendor = 'auto' } = req.body;

    if (!jsonl) {
      return res.status(400).json({ error: 'Missing jsonl data' });
    }

    const input = Readable.from([jsonl]);
    const analysis = {
      totalEvents: 0,
      eventTypes: {},
      tools: {
        total: 0,
        successful: 0,
        byName: {},
      },
      messages: {
        total: 0,
        byRole: {},
        totalChars: 0,
      },
      costs: {
        total: 0,
        events: 0,
      },
      errors: [],
    };

    for await (const event of streamEvents({
      vendor,
      source: input,
    })) {
      analysis.totalEvents++;
      analysis.eventTypes[event.t] = (analysis.eventTypes[event.t] || 0) + 1;

      switch (event.t) {
        case 'msg':
          analysis.messages.total++;
          analysis.messages.byRole[event.role] =
            (analysis.messages.byRole[event.role] || 0) + 1;
          analysis.messages.totalChars += event.text.length;
          break;

        case 'tool':
          if (event.phase === 'start') {
            analysis.tools.total++;
            analysis.tools.byName[event.name] =
              (analysis.tools.byName[event.name] || 0) + 1;
          } else if (event.phase === 'end' && event.exitCode === 0) {
            analysis.tools.successful++;
          }
          break;

        case 'cost':
          analysis.costs.total += event.deltaUsd;
          analysis.costs.events++;
          break;

        case 'error':
          analysis.errors.push(event.message);
          break;
      }
    }

    // Calculate derived metrics
    analysis.tools.successRate =
      analysis.tools.total > 0
        ? ((analysis.tools.successful / analysis.tools.total) * 100).toFixed(1)
        : 0;
    analysis.messages.avgLength =
      analysis.messages.total > 0
        ? (analysis.messages.totalChars / analysis.messages.total).toFixed(1)
        : 0;

    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new processing session
app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = ++sessionCounter;
    const { name = `Session ${sessionId}`, vendor = 'auto' } = req.body;

    sessions.set(sessionId, {
      id: sessionId,
      name,
      vendor,
      created: new Date().toISOString(),
      events: [],
      status: 'active',
    });

    res.json({ sessionId, message: 'Session created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add events to a session
app.post('/api/sessions/:id/events', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { jsonl } = req.body;
    if (!jsonl) {
      return res.status(400).json({ error: 'Missing jsonl data' });
    }

    const input = Readable.from([jsonl]);
    let addedEvents = 0;

    for await (const event of streamEvents({
      vendor: session.vendor,
      source: input,
    })) {
      session.events.push({
        ...event,
        timestamp: new Date().toISOString(),
      });
      addedEvents++;
    }

    session.updated = new Date().toISOString();

    res.json({
      sessionId,
      eventsAdded: addedEvents,
      totalEvents: session.events.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session details
app.get('/api/sessions/:id', (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get formatted output for a session
app.get('/api/sessions/:id/formatted', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { format = 'ansi' } = req.query;

    // Convert stored events back to JSONL for processing
    const jsonl = session.events
      .map(event => {
        // Convert back to original format (simplified)
        const original = {
          type:
            event.t === 'msg'
              ? 'message'
              : event.t === 'tool'
                ? 'tool_use'
                : event.t === 'cost'
                  ? 'usage'
                  : 'unknown',
          ...event,
        };
        delete original.t; // Remove normalized type field
        return JSON.stringify(original);
      })
      .join('\n');

    const input = Readable.from([jsonl]);

    // Set content type
    switch (format) {
      case 'html':
        res.setHeader('Content-Type', 'text/html');
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        break;
      default:
        res.setHeader('Content-Type', 'text/plain');
    }

    const results = [];
    for await (const formatted of streamFormat({
      vendor: session.vendor,
      source: input,
      format: format,
    })) {
      if (format === 'json') {
        results.push(formatted);
      } else {
        res.write(formatted);
      }
    }

    if (format === 'json') {
      res.json(results);
    } else {
      res.end();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessionList = Array.from(sessions.values()).map(session => ({
      id: session.id,
      name: session.name,
      vendor: session.vendor,
      created: session.created,
      updated: session.updated,
      eventCount: session.events.length,
      status: session.status,
    }));

    res.json(sessionList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Web Interface Routes
 */

// Serve the main web interface
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Stream Formatter - Web Interface</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007acc;
            padding-bottom: 10px;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fafafa;
        }
        .form-group {
            margin: 15px 0;
        }
        label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
            color: #555;
        }
        textarea, select, input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: monospace;
        }
        button {
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        button:hover {
            background: #005a9e;
        }
        .output {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
            margin: 15px 0;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.info { background: #d1ecf1; color: #0c5460; }
        .demo-buttons {
            margin: 15px 0;
        }
        .demo-buttons button {
            background: #28a745;
            margin-right: 10px;
        }
        .demo-buttons button:hover {
            background: #218838;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Agent Stream Formatter - Web Interface</h1>
        <p>Process and format AI agent CLI outputs in real-time through your browser.</p>
        
        <div class="section">
            <h2>📝 Process JSONL Data</h2>
            <div class="form-group">
                <label for="vendor">Vendor:</label>
                <select id="vendor">
                    <option value="auto">Auto-detect</option>
                    <option value="claude">Claude Code</option>
                    <option value="gemini">Gemini CLI</option>
                    <option value="amp">Amp Code</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="format">Output Format:</label>
                <select id="format">
                    <option value="ansi">ANSI Terminal</option>
                    <option value="html">HTML</option>
                    <option value="json">JSON</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="jsonl">JSONL Input:</label>
                <textarea id="jsonl" rows="8" placeholder="Paste your JSONL data here..."></textarea>
            </div>
            
            <div class="demo-buttons">
                <button onclick="loadDemo('claude')">Load Claude Demo</button>
                <button onclick="loadDemo('gemini')">Load Gemini Demo</button>
                <button onclick="loadDemo('mixed')">Load Mixed Demo</button>
            </div>
            
            <button onclick="processData()">Process Data</button>
            <button onclick="clearOutput()">Clear Output</button>
            <label>
                <input type="checkbox" id="realtime"> Real-time streaming
            </label>
            
            <div id="status"></div>
            <div id="output" class="output"></div>
        </div>
        
        <div class="section">
            <h2>📊 Analysis</h2>
            <button onclick="analyzeData()">Analyze Current Data</button>
            <div id="analysis-output" class="output"></div>
        </div>
        
        <div class="section">
            <h2>🔗 API Endpoints</h2>
            <ul>
                <li><strong>POST /api/stream</strong> - Process JSONL data</li>
                <li><strong>POST /api/analyze</strong> - Analyze JSONL data</li>
                <li><strong>GET /api/sessions</strong> - List processing sessions</li>
                <li><strong>POST /api/sessions</strong> - Create new session</li>
                <li><strong>WebSocket /</strong> - Real-time streaming</li>
            </ul>
        </div>
    </div>

    <script>
        // Demo data
        const demoData = {
            claude: '{"type":"message","role":"user","content":"Hello Claude!"}\\n{"type":"message","role":"assistant","content":"Hello! How can I help you today?"}\\n{"type":"tool_use","name":"read_file","phase":"start"}\\n{"type":"tool_use","name":"read_file","phase":"end","exit_code":0}\\n{"type":"usage","delta_usd":0.002}',
            gemini: '{"event":"content","role":"user","content":"Hello Gemini!"}\\n{"event":"content","role":"model","content":"Hello! I\\'m ready to assist you."}\\n{"event":"tool","name":"search","phase":"start"}\\n{"event":"tool","name":"search","phase":"end","status":"success"}',
            mixed: '{"type":"message","role":"user","content":"Claude format"}\\n{"event":"content","role":"model","content":"Gemini format"}\\n{"event":"message","role":"assistant","text":"Amp format"}'
        };
        
        let ws = null;
        
        function loadDemo(type) {
            document.getElementById('jsonl').value = demoData[type];
            showStatus('Demo data loaded for ' + type, 'info');
        }
        
        function showStatus(message, type = 'info') {
            const status = document.getElementById('status');
            status.className = 'status ' + type;
            status.textContent = message;
        }
        
        function clearOutput() {
            document.getElementById('output').textContent = '';
            document.getElementById('analysis-output').textContent = '';
        }
        
        async function processData() {
            const jsonl = document.getElementById('jsonl').value.trim();
            const vendor = document.getElementById('vendor').value;
            const format = document.getElementById('format').value;
            const realtime = document.getElementById('realtime').checked;
            
            if (!jsonl) {
                showStatus('Please enter some JSONL data', 'error');
                return;
            }
            
            if (realtime) {
                processRealtime(jsonl, vendor, format);
            } else {
                processStatic(jsonl, vendor, format);
            }
        }
        
        function processRealtime(jsonl, vendor, format) {
            if (ws) {
                ws.close();
            }
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host);
            
            const output = document.getElementById('output');
            output.textContent = '';
            
            ws.onopen = () => {
                showStatus('WebSocket connected, streaming data...', 'info');
                ws.send(JSON.stringify({
                    type: 'stream',
                    jsonl: jsonl,
                    vendor: vendor,
                    format: format
                }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'stream_start':
                        showStatus('Streaming started with vendor: ' + data.vendor, 'info');
                        break;
                    case 'stream_data':
                        output.textContent += data.data;
                        output.scrollTop = output.scrollHeight;
                        break;
                    case 'stream_end':
                        showStatus('Streaming completed', 'success');
                        break;
                    case 'stream_error':
                        showStatus('Stream error: ' + data.error, 'error');
                        break;
                    case 'error':
                        showStatus('Error: ' + data.error, 'error');
                        break;
                }
            };
            
            ws.onerror = () => {
                showStatus('WebSocket error', 'error');
            };
            
            ws.onclose = () => {
                showStatus('WebSocket connection closed', 'info');
            };
        }
        
        async function processStatic(jsonl, vendor, format) {
            showStatus('Processing data...', 'info');
            
            try {
                const response = await fetch('/api/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonl: jsonl,
                        vendor: vendor,
                        format: format
                    })
                });
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                
                if (format === 'json') {
                    const data = await response.json();
                    document.getElementById('output').textContent = JSON.stringify(data, null, 2);
                } else {
                    const text = await response.text();
                    document.getElementById('output').textContent = text;
                }
                
                showStatus('Processing completed', 'success');
                
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
        
        async function analyzeData() {
            const jsonl = document.getElementById('jsonl').value.trim();
            const vendor = document.getElementById('vendor').value;
            
            if (!jsonl) {
                showStatus('Please enter some JSONL data to analyze', 'error');
                return;
            }
            
            showStatus('Analyzing data...', 'info');
            
            try {
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonl: jsonl,
                        vendor: vendor
                    })
                });
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                
                const data = await response.json();
                document.getElementById('analysis-output').textContent = JSON.stringify(data, null, 2);
                showStatus('Analysis completed', 'success');
                
            } catch (error) {
                showStatus('Analysis error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
  `;

  res.send(html);
});

// Serve sample files for testing
app.get('/samples/:vendor', (req, res) => {
  try {
    const vendor = req.params.vendor;
    const samplePath = join(
      __dirname,
      `../../tests/fixtures/${vendor}/basic-message.jsonl`,
    );

    if (!existsSync(samplePath)) {
      return res.status(404).json({ error: 'Sample file not found' });
    }

    const stream = createReadStream(samplePath, { encoding: 'utf8' });
    res.setHeader('Content-Type', 'text/plain');
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start the server
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 Agent Stream Formatter Server Started');
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📋 API base URL: http://localhost:${PORT}/api`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /              - Web interface');
  console.log('  POST /api/stream    - Process JSONL data');
  console.log('  POST /api/analyze   - Analyze JSONL data');
  console.log('  GET  /api/sessions  - List sessions');
  console.log('  POST /api/sessions  - Create session');
  console.log('  WebSocket /         - Real-time streaming');
  console.log('');
  console.log('Try some sample data:');
  console.log('  Claude: curl http://localhost:3000/samples/claude');
  console.log('  Gemini: curl http://localhost:3000/samples/gemini');
  console.log('  Amp:    curl http://localhost:3000/samples/amp');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Export app for testing
export default app;
