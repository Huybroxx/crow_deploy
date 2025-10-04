import redisCache from './redis.js';

/**
 * FlashCard Cache Service
 * Provides caching strategies for flashcard operations
 */
class FlashCardCache {
    constructor() {
        // Cache TTL configurations (in seconds)
        this.TTL = {
            FLASHCARD_DETAIL: 3600,      // 1 hour
            MY_FLASHCARDS: 600,           // 10 minutes
            OTHERS_FLASHCARDS: 300,       // 5 minutes
            SEARCH_RESULTS: 180,          // 3 minutes
            STATS: 1800,                  // 30 minutes
        };

        // Cache key prefixes
        this.PREFIX = {
            FLASHCARD: 'flashcard:',
            MY_LIST: 'my_flashcards:',
            OTHERS_LIST: 'others_flashcards:',
            SEARCH: 'search:',
            USER_STATS: 'user_stats:',
        };
    }

    // ==================== KEY GENERATORS ====================

    getFlashcardKey(id) {
        return `${this.PREFIX.FLASHCARD}${id}`;
    }

    getMyFlashcardsKey(userId, page, limit) {
        return `${this.PREFIX.MY_LIST}${userId}:page_${page}:limit_${limit}`;
    }

    getOthersFlashcardsKey(userId, page, limit, searchQuery = '') {
        const search = searchQuery ? `:search_${searchQuery}` : '';
        return `${this.PREFIX.OTHERS_LIST}exclude_${userId}:page_${page}:limit_${limit}${search}`;
    }

    getSearchKey(query, userId) {
        return `${this.PREFIX.SEARCH}${userId}:${query}`;
    }

    getUserStatsKey(userId) {
        return `${this.PREFIX.USER_STATS}${userId}`;
    }

    // ==================== CACHE OPERATIONS ====================

    /**
     * Get single flashcard from cache
     */
    async getFlashcard(id) {
        return await redisCache.get(this.getFlashcardKey(id));
    }

    /**
     * Cache single flashcard
     */
    async setFlashcard(id, data) {
        return await redisCache.set(
            this.getFlashcardKey(id),
            data,
            this.TTL.FLASHCARD_DETAIL
        );
    }

    /**
     * Get my flashcards list from cache
     */
    async getMyFlashcards(userId, page, limit) {
        return await redisCache.get(this.getMyFlashcardsKey(userId, page, limit));
    }

    /**
     * Cache my flashcards list
     */
    async setMyFlashcards(userId, page, limit, data) {
        return await redisCache.set(
            this.getMyFlashcardsKey(userId, page, limit),
            data,
            this.TTL.MY_FLASHCARDS
        );
    }

    /**
     * Get others flashcards list from cache
     */
    async getOthersFlashcards(userId, page, limit, searchQuery = '') {
        return await redisCache.get(
            this.getOthersFlashcardsKey(userId, page, limit, searchQuery)
        );
    }

    /**
     * Cache others flashcards list
     */
    async setOthersFlashcards(userId, page, limit, searchQuery = '', data) {
        return await redisCache.set(
            this.getOthersFlashcardsKey(userId, page, limit, searchQuery),
            data,
            this.TTL.OTHERS_FLASHCARDS
        );
    }

    /**
     * Get search results from cache
     */
    async getSearchResults(query, userId) {
        return await redisCache.get(this.getSearchKey(query, userId));
    }

    /**
     * Cache search results
     */
    async setSearchResults(query, userId, data) {
        return await redisCache.set(
            this.getSearchKey(query, userId),
            data,
            this.TTL.SEARCH_RESULTS
        );
    }

    // ==================== CACHE INVALIDATION ====================

    /**
     * Invalidate cache when flashcard is created/updated/deleted
     */
    async invalidateFlashcard(flashcardId, userId) {
        const tasks = [
            // Invalidate specific flashcard
            redisCache.del(this.getFlashcardKey(flashcardId)),

            // Invalidate all pages of user's flashcards
            redisCache.delByPattern(`${this.PREFIX.MY_LIST}${userId}:*`),

            // Invalidate all search results for this user
            redisCache.delByPattern(`${this.PREFIX.SEARCH}${userId}:*`),

            // Invalidate user stats
            redisCache.del(this.getUserStatsKey(userId)),
        ];

        await Promise.all(tasks);
        console.log(`🗑️  Cache invalidated for flashcard ${flashcardId}`);
    }

    /**
     * Invalidate cache when a card is added to flashcard set
     */
    async invalidateFlashcardUpdate(flashcardId, userId) {
        await this.invalidateFlashcard(flashcardId, userId);
        // Also invalidate others' view since card count changed
        await redisCache.delByPattern(`${this.PREFIX.OTHERS_LIST}*`);
    }

    /**
     * Invalidate all user's flashcard caches
     */
    async invalidateUserFlashcards(userId) {
        const tasks = [
            redisCache.delByPattern(`${this.PREFIX.MY_LIST}${userId}:*`),
            redisCache.delByPattern(`${this.PREFIX.SEARCH}${userId}:*`),
            redisCache.del(this.getUserStatsKey(userId)),
            // Invalidate others list because new card appeared
            redisCache.delByPattern(`${this.PREFIX.OTHERS_LIST}*`),
        ];

        await Promise.all(tasks);
        console.log(`🗑️  All cache invalidated for user ${userId}`);
    }

    /**
     * Invalidate others' flashcard lists (when someone creates/deletes flashcard)
     */
    async invalidateOthersLists() {
        await redisCache.delByPattern(`${this.PREFIX.OTHERS_LIST}*`);
        console.log(`🗑️  Others flashcards cache invalidated`);
    }

    /**
     * Clear all flashcard related cache
     */
    async clearAllFlashcardCache() {
        const tasks = [
            redisCache.delByPattern(`${this.PREFIX.FLASHCARD}*`),
            redisCache.delByPattern(`${this.PREFIX.MY_LIST}*`),
            redisCache.delByPattern(`${this.PREFIX.OTHERS_LIST}*`),
            redisCache.delByPattern(`${this.PREFIX.SEARCH}*`),
            redisCache.delByPattern(`${this.PREFIX.USER_STATS}*`),
        ];

        await Promise.all(tasks);
        console.log('🗑️  All flashcard cache cleared');
    }

    // ==================== CACHE WARMING ====================

    /**
     * Pre-populate cache with popular flashcards
     */
    async warmCache(popularFlashcards) {
        console.log('🔥 Warming up cache...');
        const tasks = popularFlashcards.map(flashcard =>
            this.setFlashcard(flashcard._id.toString(), flashcard)
        );
        await Promise.all(tasks);
        console.log(`🔥 Cached ${popularFlashcards.length} popular flashcards`);
    }

    // ==================== STATS ====================

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        const stats = await redisCache.getStats();
        return stats;
    }

    /**
     * Check cache health
     */
    async healthCheck() {
        return redisCache.isConnected;
    }
}

// Singleton instance
const flashCardCache = new FlashCardCache();

export default flashCardCache;
