import { Server } from "socket.io";
import express from "express";
import http from "http";
import mongoose from 'mongoose';
import User from '../models/user.model.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const io = new Server(server, {
    cors: {
        origin: `https://localhost:5000`,
        methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
});

// Hàm chuyển userId thành ObjectId nếu cần
const convertToObjectId = (userId) => new mongoose.Types.ObjectId(userId);

// Danh sách socket của từng user
const userSocketMap = {};

// Hàm cập nhật trạng thái hoạt động của user
const updateLastActiveTime = async (userId) => {
    try {
        const userObj = convertToObjectId(userId);
        await User.findByIdAndUpdate(userObj, { lastActiveAt: new Date() });
    } catch (error) {
        console.error("Lỗi khi cập nhật thời gian hoạt động cuối: ", error);
    }
};

// Trả về danh sách socket của user
export const getReciverSocketIds = (userId) => {
    return userSocketMap[userId] ? Array.from(userSocketMap[userId]) : [];
};

// Xử lý khi user kết nối
const handleUserConnection = async (socket, userId) => {
    if (!userSocketMap[userId]) {
        userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);

    await updateLastActiveTime(userId);
    console.log(`🔗 User kết nối: ${userId} | Socket: ${socket.id}`);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
};

// Xử lý khi user ngắt kết nối
const handleUserDisconnection = async (socket, userId) => {
    if (userSocketMap[userId]) {
        userSocketMap[userId].delete(socket.id);
        if (userSocketMap[userId].size === 0) {
            delete userSocketMap[userId];
        }
    }

    await updateLastActiveTime(userId);
    console.log(`❌ User ngắt kết nối: ${userId} | Socket: ${socket.id}`);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
};

// Xử lý tin nhắn
const handleChatMessage = async (socket, { receiverId, message, senderId }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    receiverSockets.forEach(socketId => {
        io.to(socketId).emit("newMessage", { senderId, message, timestamp: new Date() });
    });

    console.log(`💬 Message: ${senderId} → ${receiverId}: ${message}`);

    // Lưu tin nhắn vào database
    try {
        const Conversation = (await import('../models/conversation.model.js')).default;
        const Message = (await import('../models/message.model.js')).default;

        let conversation = await Conversation.findOne({
            members: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                members: [senderId, receiverId],
                messages: []
            });
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            message
        });

        conversation.messages.push(newMessage._id);
        await conversation.save();

        console.log('✅ Message saved to database');
    } catch (error) {
        console.error('❌ Error saving message:', error);
    }
};
//gửi peerID server nhận được từ client cho người nhận
const sendPeerId = (socket, { receiverId, callerId, peerId }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    if (receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("receivePeerId", {
                callerId,
                peerId
            });
        });
        console.log(`Đã gửi peerId (${peerId}) cho người nhận (${receiverId})`);
    } else {
        socket.emit("callError", { message: "Người nhận không trực tuyến." });
    }
};


// Xử lý notification
const handleNotification = (socket, { receiverId, notification }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    receiverSockets.forEach(socketId => {
        io.to(socketId).emit("notification", notification);
    });
};

// Xử lý kết nối Socket.IO
io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (!userId) {
        console.log("⚠️ Kết nối từ chối: Không có userId");
        socket.disconnect();
        return;
    }

    handleUserConnection(socket, userId);

    socket.on("sendMessage", (data) => handleChatMessage(socket, data));

    socket.on("sendNotification", (data) => handleNotification(socket, data));

    //gửi peerID server nhận được từ client cho người nhận
    socket.on("sendPeerId", (data) => sendPeerId(socket, data));

    // Xử lý typing indicator
    socket.on("typing", ({ receiverId, isTyping }) => {
        const receiverSocketIds = getReciverSocketIds(receiverId);
        receiverSocketIds.forEach(socketId => {
            io.to(socketId).emit("userTyping", { senderId: userId, isTyping });
        });
    });

    socket.on("disconnect", () => {
        handleUserDisconnection(socket, userId);
    });

    socket.on("error", (err) => {
        console.error(`⚠️ Lỗi socket: userId=${userId}, socketId=${socket.id}, lỗi=`, err);
    });
});

export { io, server, app };
