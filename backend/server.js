require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chatRoutes = require('./routes/chatRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/admin', adminRoutes);

// MongoDB connection
console.log('[Database] Connecting to MongoDB Atlas...');
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  tls: true,
  tlsAllowInvalidCertificates: false
})
  .then(() => {
    console.log('[Database] Successfully connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`[Server] Backend is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[Database] ❌ Connection failed!');
    if (error.message.includes('IP address')) {
      console.error('[Database] TIP: Your current IP is likely NOT whitelisted on MongoDB Atlas.');
      console.error('[Database] Go to: https://cloud.mongodb.com/ -> Network Access -> Add IP Address');
    } else {
      console.error('[Database] Error Details:', error.message);
    }
    process.exit(1); // Stop the server if DB fails
  });
