import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFile, uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    //TODO: get all videos based on query, sort, pagination
    // const skip = (page - 1) * limit;

    // const videos = await Video.find({
    //     $text: { $search: query },
    // })
    //     .skip(skip)
    //     .limit(limit);

    // console.log(videos);
    // return res
    //     .status(200)
    //     .json(new ApiResponse(200, videos, "video fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) {
        throw new ApiError(400, "Title and Description are required.");
    }

    if (
        !req.files ||
        !Array.isArray(req.files?.thumbnail) ||
        !(req.files.thumbnail.length > 0)
    ) {
        fs.unlinkSync(req?.files?.thumbnail?.path);
        fs.unlinkSync(req?.files?.videoFile?.path);
        throw new ApiError(400, "Thumbnail is required.");
    }

    if (
        !req.files ||
        !Array.isArray(req.files?.videoFile) ||
        !(req.files.videoFile.length > 0)
    ) {
        fs.unlinkSync(req?.files?.thumbnail?.path);
        fs.unlinkSync(req?.files?.videoFile?.path);
        throw new ApiError(400, "videoFile is required.");
    }
    const thumbnailPath = req.files.thumbnail[0].path;
    const videoPath = req.files.videoFile[0].path;

    const thumbnail = await uploadOnCloudinary(thumbnailPath);
    const videoFile = await uploadOnCloudinary(videoPath);

    const video = await Video.create({
        owner: req.user._id,
        title,
        description,
        thumbnail: thumbnail.url,
        videoFile: videoFile.url,
        duration: videoFile.duration,
    });

    return res.status(201).json(new ApiResponse(201, video, "video uploaded."));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "videoId is required.");
    }
    try {
        const video = await Video.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(videoId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    foreignField: "_id",
                    localField: "owner",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                email: 1,
                                fullName: 1,
                                avatar: 1,
                                coverImage: 1,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner",
                    },
                },
            },
        ]);

        if (!video?.[0]) {
            throw new ApiError(400, "Invalid videoId");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, video, "video fetch successfully"));
    } catch (error) {
        throw new ApiError(400, "Invalid videoId");
    }
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!videoId) {
        throw new ApiError(400, "videoId is required.");
    }

    if (!(title || description || req.file)) {
        throw new ApiError(
            400,
            "title or description or thumbnail is required.",
        );
    }

    try {
        let thumbnail;

        if (req.file) {
            thumbnail = await uploadOnCloudinary(req.file.path);
        }

        const video = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    title,
                    description,
                    thumbnail: thumbnail?.url,
                },
            },
            { new: true },
        );

        if (!video) {
            throw new ApiError(400, "Invalid videoId");
        }

        return res
            .status(201)
            .json(new ApiResponse(201, video, "video updated successfully"));
    } catch (error) {
        throw new ApiError(400, error);
    }
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "videoId is required.");
    }

    const video = await Video.findByIdAndDelete(videoId);

    if (!video) {
        throw new ApiError(400, "Invalid videoId");
    }

    await deleteFile(video.videoFile);

    return res.status(200).json(new ApiResponse(200, video, "video deleted"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "videoId is required.");
    }

    const video = await Video.findById(videoId);
    video.isPublished = !video.isPublished;
    video.save();

    if (!video) {
        throw new ApiError(400, "Invalid videoId");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, video, "toggled isPublish successfully."));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
