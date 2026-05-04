require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const seedAdmin = require("./utils/seedAdmin");

const PORT = process.env.PORT;




const { Server } = require('socket.io');
const DriverLocation = require('./models/DriverLocation');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Seed default admin on first start
  await seedAdmin();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(
      `\n🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`,
    );
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API base:     http://localhost:${PORT}/api\n`);
  });

  // Socket.io setup
  const io = new Server(server, {
    cors: {
      origin: '*', // Adjust for prod
    }
  });

  app.io = io; // attach to app

  io.on('connection', (socket) => {
    console.log('Socket client connected:', socket.id);

    // Driver app to ping location
    socket.on('driver:location', async (data) => {
      try {
        const { driverId, coordinates } = data;
        await DriverLocation.findOneAndUpdate(
          { driverId },
          {
            location: { type: 'Point', coordinates },
            lastSeen: new Date()
          },
          { upsert: true, new: true }
        );
        // Optionally broadcast driver location to admins
        io.emit('driver:location:update', { driverId, coordinates });
      } catch (err) {
        console.error('Error saving driver location:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket client disconnected:', socket.id);
    });
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("✅ HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Unhandled promise rejections
  process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
  });
};

startServer();
