import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import { uploadImage, deleteMediaById } from '../helper/upload-media.js';

// Hiển thị trang cộng đồng
export const getCommunity = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Số bài viết mỗi trang
        const skip = (page - 1) * limit;

        // Đếm tổng số bài viết
        const totalPosts = await Post.countDocuments();
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await Post.find()
            .populate("author", "username avatar")
            .populate({
                path: "comments",
                populate: { path: "author", select: "username avatar" }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log("posts", posts);


        res.render("./page/community/community", {
            title: "Cộng đồng",
            posts,
            user: req.user || null, // Truyền user từ middleware requireAuth
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        });

    } catch (error) {
        console.error("Lỗi khi lấy bài viết:", error);
        res.status(500).send("Lỗi máy chủ");
    }
};

//Tao bai viet
export const createPost = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }

        const { caption, desc } = req.body;
        const img = req.file;

        if (!img) {
            return res.status(400).json({ message: "Vui lòng tải lên một hình ảnh" });
        }
        const imgUrl = await uploadImage(img);
        const newPost = new Post({
            caption,
            desc,
            img: imgUrl,
            author: req.user._id,
        });

        await newPost.save();
        console.log("Bài viết tạo thành cong");
        res.redirect('/community');

    } catch (error) {
        console.error('Lỗi đăng bài:', error);
        res.status(500).send('Lỗi máy chủ');
    }
};

//xoa bai viet
export const deletePost = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }

        const postId = req.params.postId;
        const userId = req.user._id;

        const post = await Post.findOne({ _id: postId, author: userId });

        if (!post) {
            return res.status(404).json({ message: "Bài viết không tồn tại hoặc bạn không có quyền xóa" });
        }
        try {
            await deleteMediaById(post.img, "image");
            console.log("Xóa hình ảnh");
        } catch (error) {
            console.error("Lỗi khi xóa hình ảnh:", error);
        }

        await Comment.deleteMany({ post: postId });
        console.log("Xóa tất cả bình luận của bài viết");

        await Post.deleteOne({ _id: postId });
        console.log("Xóa bài viết");
        res.json({
            success: true,
            message: "Xóa bài viết thành công"
        });
    } catch (error) {
        console.error("Lỗi khi xóa bài viết:", error);
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

//sua bai viet
export const editPost = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }

        const postId = req.params.postId;
        const userId = req.user._id;
        const { caption, desc } = req.body;

        const post = await Post.findOne({ _id: postId, author: userId });
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại hoặc bạn không có quyền chỉnh sửa"
            });
        }

        if (caption !== undefined) post.caption = caption;
        if (desc !== undefined) post.desc = desc;

        console.log("Sua Thanh cong");
        await post.save();

        res.json({
            success: true,
            message: "Cập nhật bài viết thành công",
            post: {
                caption: post.caption,
                desc: post.desc
            }
        });
    } catch (error) {
        console.error("Lỗi khi chỉnh sửa bài viết:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi máy chủ"
        });
    }
};


// like bai viet
export const likePost = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }

        const postId = req.params.postId;
        const userId = req.user._id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Bài viết không tồn tại" });
        }

        const hasLiked = post.likes.includes(userId);
        if (hasLiked) {
            post.likes = post.likes.filter(id => id.toString() !== userId.toString());
        } else {
            post.likes.push(userId);
        }

        await post.save();

        res.json({
            success: true,
            likesCount: post.likes.length,
            hasLiked: !hasLiked
        });
    } catch (error) {
        console.error("Lỗi khi like bài viết:", error);
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

//comment bai viet
export const createComment = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }

        const postId = req.params.postId;
        const userId = req.user._id;
        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).json({ message: "Nội dung bình luận không được để trống" });
        }


        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Bài viết không tồn tại" });
        }

        const newComment = new Comment({
            text,
            author: userId,
            post: postId,
        });

        await newComment.save();

        post.comments.push(newComment._id);
        await post.save();

        // Populate thông tin author để trả về
        const populatedComment = await Comment.findById(newComment._id)
            .populate("author", "username avatar");

        res.json({
            success: true,
            message: "Đã thêm bình luận thành công",
            comment: {
                _id: populatedComment._id,
                text: populatedComment.text,
                author: {
                    username: populatedComment.author.username,
                    avatar: populatedComment.author.avatar,
                },
                createdAt: populatedComment.createdAt,
            },
        });
    } catch (error) {
        console.error("Lỗi khi thêm bình luận:", error);
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};