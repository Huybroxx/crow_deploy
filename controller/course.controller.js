import mongoose from "mongoose";
import Lesson from "../models/lesson.model.js";
import Course from "../models/course.model.js";
import { uploadVideo, uploadImage, deleteMediaById } from "../helper/upload-media.js";
// [GET] /course - Hiển thị danh sách khóa học
export const coursePage = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Số khóa học mỗi trang
        const skip = (page - 1) * limit;

        // Đếm tổng số khóa học
        const totalCourses = await Course.countDocuments();
        const totalPages = Math.ceil(totalCourses / limit);

        const courses = await Course.find()
            .skip(skip)
            .limit(limit);

        console.log("📢 Courses from DB:", courses);
        res.render('./page/course/index', {
            title: 'Khóa học',
            courses: courses,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Không tìm thấy khóa học');
        res.redirect('back');
    }
};

// [GET] /course/:id - Hiển thị chi tiết khóa học
export const courseDetailPage = async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await Course.findById(courseId).populate("lessons");

        if (!course) {
            req.flash('error', 'Khóa học không tìm thấy');
            return res.redirect('/course');
        }

        // Lấy danh sách các khóa học liên quan
        const relatedCourses = await Course.find({
            _id: { $ne: courseId }, // Không lấy chính khóa học này
            language: course.language, // Lấy các khóa học có cùng ngôn ngữ
        }).limit(4); // Giới hạn số lượng

        console.log("📢 Course from DB:", course);


        res.render("./page/course/detail", {
            title: course.name,
            course: course,
            relatedCourses: relatedCourses
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Không tìm thấy khóa học');
        res.redirect('/course');
    }
};

// [GET] /course/:courseId/lesson/:lessonId - Hiển thị bài học cụ thể


export const lessonDetailPage = async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.user._id;

        const course = await Course.findById(courseId).populate("lessons");
        if (!course) {
            req.flash('error', 'Khóa học không tồn tại.');
            return res.redirect('/course');
        }

        const lesson = course.lessons.find(lesson => lesson._id.toString() === lessonId);
        if (!lesson) {
            req.flash('error', 'Bài học không tồn tại.');
            return res.redirect(`/course/${courseId}`);
        }

        const userNote = lesson.notes.find(note => note.userId.toString() === userId.toString());

        console.log("Lesson from DB:", lesson); // Debug để xem lesson có type không
        res.render('page/course/lesson', {
            title: lesson.title,
            lesson: lesson,
            course: course,
            userNote: userNote ? userNote.content : ''
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Không tìm thấy bài học');
        res.redirect('back');
    }
};

export const saveLessonNote = async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;
        const { noteContent } = req.body;
        const userId = req.user._id; // Lấy từ middleware auth

        const course = await Course.findById(courseId).populate("lessons");
        if (!course) {
            return res.status(404).json({ error: 'Khóa học không tồn tại' });
        }

        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ error: 'Bài học không tồn tại' });
        }

        // Tìm ghi chú cũ của user
        const existingNoteIndex = lesson.notes.findIndex(note => note.userId.toString() === userId.toString());
        if (existingNoteIndex >= 0) {
            // Cập nhật ghi chú cũ
            lesson.notes[existingNoteIndex].content = noteContent;
        } else {
            // Thêm ghi chú mới
            lesson.notes.push({ userId, content: noteContent });
        }

        await lesson.save();
        res.redirect(`/course/${courseId}/lesson/${lessonId}`);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi lưu ghi chú' });
    }
};
// [POST] /course/create
export const createCourse = async (req, res) => {
    try {
        const { name, language, description, price } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'File is required' });
        }

        const thumbnailUrl = await uploadImage(file);

        const newCourse = new Course({
            name,
            language,
            description,
            price,
            thumbnail: thumbnailUrl,
        });

        await newCourse.save();
        res.status(200).json({ message: 'Thêm khóa học thành công' });
        // , course: newCourse
    } catch (error) {
        console.error("🚨 Lỗi tạo khóa học:", error); // In lỗi ra console
        res.status(500).json({ error: 'Lỗi khi tạo khóa học' });
        //  details: error.message
    }
};



export const addLessonVideo = async (req, res) => {
    try {
        const { courseId, title, content } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'File is required' });
        }
        const videoUrl = await uploadVideo(file);
        const newLesson = new Lesson({
            title,
            type: 'video',
            content,
            videoUrl: videoUrl
        });
        await newLesson.save();
        const course = await Course.findById(courseId);
        course.lessons.push(newLesson._id);
        await course.save();

        res.status(200).json({ message: 'Them video thanh cong' });
    } catch (error) {
        res.status(500).json({ error: 'Loi khi them video' });
    }
}
export const createLessonTask = async (req, res) => {
    try {
        const { courseId, title, content, jsonTask } = req.body;
        const course = await Course.findById(courseId);
        if (!course) {
            res.status(404).json({ error: 'Không tìm thấy khóa học' });
        }
        const lesson = new Lesson({
            title,
            type: 'task',
            content,
            jsonTask,
        });
        await lesson.save();
        course.lessons.push(lesson);
        await course.save();
        return res.status(201).json({ message: 'Tạo khóa học thành công', lesson });


    } catch (error) {
        res.status(500).json({ error: 'Lỗi server' });
    }
};
export const deleteLesson = async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;

        // Tìm và xóa bài học
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ error: 'Bài học không tồn tại' });
        }
        const mediaPromises = [];
        if (lesson.videoPublicId) {
            mediaPromises.push(
                deleteMediaById(lesson.videoPublicId, 'video')
                    .catch(err => console.error('Error deleting video:', err))
            );
        }
        await Promise.all(mediaPromises);
        await Lesson.findByIdAndDelete(lessonId);
        await Course.findByIdAndUpdate(courseId, { $pull: { lessons: lessonId } });

        res.status(200).json({ message: 'Xóa bài học thành công' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa bài học' });
    }
};

export const deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Tìm và xóa khóa học
        const course = await Course.findById(courseId);


        if (!course) {
            return res.status(404).json({ error: 'Khóa học không tồn tại' });
        }

        // Xóa tất cả bài học liên quan
        await Lesson.deleteMany({ _id: { $in: course.lessons } });

        res.status(200).json({ message: 'Xóa khóa học thành công' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa khóa học' });
    }
};
