import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './env';

let redisClient: Redis;

export function getRedisConnection(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const connectionOptions = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  };

  const realRedis = new Redis(connectionOptions);

  realRedis.on('error', (err) => {
    // Suppress spammy log if fallback is enabled
  });

  // Default to real Redis connection attempt
  redisClient = realRedis;
  return redisClient;
}

export function createRedisInstance(): Redis {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
