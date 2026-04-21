require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const seedAdmin = require("./utils/seedAdmin");

const PORT = process.env.PORT;

  


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
