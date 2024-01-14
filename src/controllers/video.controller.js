import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    //TODO: get all videos based on query, sort, pagination
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
        const video = await Video.findById(videoId);
        if (!video) {
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
    //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
