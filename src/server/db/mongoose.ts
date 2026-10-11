import mongoose from "mongoose";

import { getRequiredEnv } from "@/server/config/env";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __makeMyMarriageMongoose?: MongooseCache;
};

const cache =
  globalForMongoose.__makeMyMarriageMongoose ??
  (globalForMongoose.__makeMyMarriageMongoose = {
    connection: null,
    promise: null,
  });

export async function connectToDatabase() {
  if (cache.connection?.connection.readyState === 1) return cache.connection;

  const uri = getRequiredEnv("MONGODB_URI");
  const dbName = getRequiredEnv("MONGO_DB_NAME");
  cache.promise ??= mongoose.connect(uri, { bufferCommands: false, dbName });

  try {
    cache.connection = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.connection;
}
