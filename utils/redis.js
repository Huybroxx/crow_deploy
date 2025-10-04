import Redis from 'ioredis';

class RedisCache {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            this.client = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
            });

            this.client.on('connect', () => {
                console.log('✅ Redis connected successfully');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                console.error('❌ Redis connection error:', err);
                this.isConnected = false;
            });

            this.client.on('close', () => {
                console.log('Redis connection closed');
                this.isConnected = false;
            });

            // Test connection
            await this.client.ping();
            return this.client;
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.isConnected = false;
            return null;
        }
    }

    /**
     * Get value from cache
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
        if (!this.isConnected) return null;

        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    }

    /**
     * Set value to cache with expiration
     * @param {string} key
     * @param {any} value
     * @param {number} ttl - Time to live in seconds (default: 1 hour)
     * @returns {Promise<boolean>}
     */
    async set(key, value, ttl = 3600) {
        if (!this.isConnected) return false;

        try {
            await this.client.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    }

    /**
     * Delete one or multiple keys
     * @param {string|string[]} keys
     * @returns {Promise<boolean>}
     */
    async del(keys) {
        if (!this.isConnected) return false;

        try {
            await this.client.del(keys);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    }

    /**
     * Delete keys by pattern
     * @param {string} pattern
     * @returns {Promise<boolean>}
     */
    async delByPattern(pattern) {
        if (!this.isConnected) return false;

        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
            return true;
        } catch (error) {
            console.error('Redis DEL by pattern error:', error);
            return false;
        }
    }

    /**
     * Clear all cache
     * @returns {Promise<boolean>}
     */
    async flushAll() {
        if (!this.isConnected) return false;

        try {
            await this.client.flushall();
            console.log('✅ Redis cache cleared');
            return true;
        } catch (error) {
            console.error('Redis FLUSH error:', error);
            return false;
        }
    }

    /**
     * Get cache stats
     * @returns {Promise<object>}
     */
    async getStats() {
        if (!this.isConnected) return null;

        try {
            const info = await this.client.info('stats');
            const keyspace = await this.client.info('keyspace');
            return { info, keyspace };
        } catch (error) {
            console.error('Redis STATS error:', error);
            return null;
        }
    }

    /**
     * Check if key exists
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        if (!this.isConnected) return false;

        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    }

    /**
     * Set expiration on key
     * @param {string} key
     * @param {number} ttl - seconds
     * @returns {Promise<boolean>}
     */
    async expire(key, ttl) {
        if (!this.isConnected) return false;

        try {
            await this.client.expire(key, ttl);
            return true;
        } catch (error) {
            console.error('Redis EXPIRE error:', error);
            return false;
        }
    }

    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            console.log('Redis disconnected');
        }
    }
}

// Singleton instance
const redisCache = new RedisCache();

export default redisCache;
