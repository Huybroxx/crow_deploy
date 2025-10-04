# 🚀 Quick Start Guide - Redis Cache & Database Indexing

## Bước 1: Start Redis với Docker

```bash
docker-compose up -d
```

Kiểm tra Redis đang chạy:
```bash
docker-compose ps
# Should show: crow_redis  Up  6379/tcp
```

## Bước 2: Tạo Fake Data (1000+ flashcards)

```bash
node scripts/seed-flashcards.js
```

Output mong đợi:
```
✅ Connected to MongoDB
✅ Found user: hphuc (...)
🚀 Creating 1000 flashcards...
✅ Batch 1/20 completed (50/1000)
...
🎉 Done! Total flashcards: 1000
```

## Bước 3: Test Performance

```bash
node scripts/test-performance.js
```

Output mong đợi:
```
📊 Test 1: Get flashcard detail
⏱️  DB Query (no cache): 35ms
⚡ Cache Query: 2ms
🚀 Improvement: 17.50x faster

📊 Test 2: List user flashcards
⏱️  DB Query (no cache): 120ms
⚡ Cache Query: 3ms
🚀 Improvement: 40.00x faster

📊 Test 3: Search flashcards
⏱️  Regex Search: 250ms
⚡ Text Index Search: 45ms
⚡ Cached Search: 2ms
🚀 vs Regex: 125.00x faster
```

## Bước 4: Start Server & Test

```bash
npm start
```

Truy cập: http://localhost:5000/flashcards

### Quan sát Console Logs:

**Lần đầu tiên (Cache MISS):**
```
🔍 Cache MISS - Loading my flashcards from DB
🔍 Cache MISS - Loading others flashcards from DB
```

**Lần sau (Cache HIT):**
```
✅ Cache HIT - My flashcards
✅ Cache HIT - Others flashcards
```

**Sau khi tạo flashcard mới:**
```
🗑️  All cache invalidated for user xxx
🔍 Cache MISS - Loading my flashcards from DB (cache refreshed)
```

## Bước 5: Test Search

1. Vào trang flashcards
2. Gõ từ khóa vào search box (ví dụ: "technology")
3. Xem console logs:

**Lần đầu:**
```
🔍 Cache MISS - Loading others flashcards from DB
```

**Lần sau với cùng search query:**
```
✅ Cache HIT - Others flashcards
```

## ✅ Checklist Xác Nhận

- [ ] Redis container đang chạy (`docker-compose ps`)
- [ ] Có 1000+ flashcards trong database
- [ ] Server start thành công với log "✅ Redis connected successfully"
- [ ] Thấy logs "Cache HIT" và "Cache MISS" khi load trang
- [ ] Search nhanh hơn rõ rệt so với trước

## 🐛 Troubleshooting

### Redis không connect:
```bash
docker-compose restart redis
# Check logs
docker-compose logs redis
```

### Indexes chưa được tạo:
```javascript
// Trong MongoDB Compass hoặc Atlas
// Check collection "flashcards" → Indexes tab
// Should see:
// - _id_ (default)
// - name_text (text index)
// - user_1_createdAt_-1 (compound)
// - user_1
// - user_1_name_1
```

Nếu chưa có, restart server để MongoDB tạo indexes.

### Performance không khác biệt:
- Đảm bảo có đủ 1000+ flashcards
- Clear cache: Restart Redis hoặc dùng `flushall` command
- Test lại từ đầu

## 📊 Metrics to Watch

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Flashcard Detail | 30-80ms | 1-3ms | < 5ms |
| List Query | 50-150ms | 1-5ms | < 10ms |
| Search | 100-300ms | 2-8ms | < 10ms |
| Memory Usage | 0 MB | ~50-100 MB | < 200 MB |

## 🎯 Success Criteria

✅ **Cache Hit Rate**: > 80% sau 10 minutes sử dụng
✅ **Query Time**: Giảm 10-100x
✅ **Search Performance**: < 10ms với cache
✅ **Text Search**: Hoạt động với relevance scoring

---

🎉 **Hoàn thành!** Bạn đã có một hệ thống flashcards với Redis cache và database indexing hoàn chỉnh!
