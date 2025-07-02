// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware (optional)
app.use(cors({ origin: 'https://mp3-metadata-finder.vercel.app' }));
app.use(express.json());

// Routes
const indexRoutes = require('./routes/index');

// Use routes
app.use('/api', indexRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;