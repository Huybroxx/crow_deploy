import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import env from 'dotenv';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pug from 'pug';
import http from 'http';
import { ExpressPeerServer } from 'peer';
import flash from 'express-flash';
import connectDB from "./utils/db.js";
import redisCache from "./utils/redis.js";
import router from './routes/index.js';
import session from 'express-session';

env.config();

import { app, server } from "./socket/socket.js";

const PORT = process.env.PORT || 5000;

// Cấu hình CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'https://localhost:5000'],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(flash());

// Kết nối MongoDB
await connectDB();

// Kết nối Redis
await redisCache.connect();

// Cấu hình method-override và body-parser
app.use(methodOverride('_method'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cấu hình public folder trước
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(`${__dirname}/public`));

// Cấu hình view engine
app.set('views', `${__dirname}/views`);
app.set('view engine', 'pug');

// Tích hợp PeerServer vào Express
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true
});

// Middleware sử dụng PeerServer
app.use('', peerServer);


// Lắng nghe sự kiện peer connect và disconnect
peerServer.on('connection', (peer) => {
  console.log('Peer connected:', peer.id);
});

peerServer.on('disconnect', (peer) => {
  console.log('Peer disconnected:', peer.id);
});

// router
app.use(router);

// Khởi động server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
