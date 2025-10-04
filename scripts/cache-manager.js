import mongoose from 'mongoose';
import dotenv from 'dotenv';
import redisCache from '../utils/redis.js';
import flashCardCache from '../utils/flashcard-cache.js';

dotenv.config();

const commands = {
    'clear': 'Clear all flashcard cache',
    'stats': 'Show cache statistics',
    'health': 'Check Redis health',
    'keys': 'List all cache keys',
    'flush': 'Flush all Redis data (DANGEROUS)',
    'help': 'Show this help message',
};

async function showHelp() {
    console.log('\n📚 Redis Cache Management Tool\n');
    console.log('Usage: node scripts/cache-manager.js <command>\n');
    console.log('Available commands:');
    Object.entries(commands).forEach(([cmd, desc]) => {
        console.log(`  ${cmd.padEnd(10)} - ${desc}`);
    });
    console.log();
}

async function clearCache() {
    try {
        await redisCache.connect();
        await flashCardCache.clearAllFlashcardCache();
        console.log('✅ All flashcard cache cleared successfully');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function showStats() {
    try {
        await redisCache.connect();
        const stats = await flashCardCache.getCacheStats();
        console.log('\n📊 Redis Cache Statistics:\n');
        console.log(stats);
        console.log();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function checkHealth() {
    try {
        await redisCache.connect();
        const isHealthy = await flashCardCache.healthCheck();
        if (isHealthy) {
            console.log('✅ Redis is healthy and connected');
        } else {
            console.log('❌ Redis is not connected');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function listKeys() {
    try {
        await redisCache.connect();
        const keys = await redisCache.client.keys('*');
        console.log(`\n🔑 Found ${keys.length} cache keys:\n`);

        if (keys.length === 0) {
            console.log('(empty)');
        } else {
            // Group keys by prefix
            const grouped = {};
            keys.forEach(key => {
                const prefix = key.split(':')[0];
                if (!grouped[prefix]) grouped[prefix] = [];
                grouped[prefix].push(key);
            });

            Object.entries(grouped).forEach(([prefix, keys]) => {
                console.log(`📁 ${prefix}: (${keys.length} keys)`);
                keys.slice(0, 5).forEach(key => console.log(`   - ${key}`));
                if (keys.length > 5) {
                    console.log(`   ... and ${keys.length - 5} more`);
                }
                console.log();
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function flushAll() {
    try {
        console.log('⚠️  WARNING: This will delete ALL data in Redis!');
        console.log('This operation cannot be undone.\n');

        // Simple confirmation (in production, use readline for better UX)
        const confirm = process.argv[3];
        if (confirm !== '--confirm') {
            console.log('To confirm, run: node scripts/cache-manager.js flush --confirm');
            return;
        }

        await redisCache.connect();
        await redisCache.flushAll();
        console.log('✅ All Redis data flushed');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function main() {
    const command = process.argv[2];

    if (!command || command === 'help') {
        await showHelp();
        return;
    }

    switch (command) {
        case 'clear':
            await clearCache();
            break;
        case 'stats':
            await showStats();
            break;
        case 'health':
            await checkHealth();
            break;
        case 'keys':
            await listKeys();
            break;
        case 'flush':
            await flushAll();
            break;
        default:
            console.log(`❌ Unknown command: ${command}`);
            await showHelp();
    }

    await redisCache.disconnect();
    console.log('👋 Done\n');
    process.exit(0);
}

main();
