import mongoose from "mongoose";

/**
 * Connect to MongoDB.
 * Data migrations and index changes must run separately,
 * not automatically during server startup.
 */
export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing environment variable: MONGODB_URI");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}
