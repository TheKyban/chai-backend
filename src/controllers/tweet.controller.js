import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    /**
     * To create tweet user must be logged in.
     */

    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "Content required !!");
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user._id,
    });

    if (!tweet) {
        throw new ApiError(500, "Something went wrong while creating tweet");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, tweet, "tweet created successfully."));
});

const getUserTweets = asyncHandler(async (req, res) => {
    /**
     * Get userId from params.
     * verify userId is valid or not
     * find tweets
     * return user and tweets
     */
    const { userId } = req.params;

    if (!userId) {
        throw new ApiError(400, "userId is required.");
    }
    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(400, "Invalid userId");
    }
    const tweets = await Tweet.find({
        owner: userId,
    });

    if (!tweets) {
        throw new ApiError(400, "Error while fetching tweets");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { user, tweets }, "tweets fetched"));
});

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!tweetId) {
        throw new ApiError(400, "tweetId is required.");
    }

    if (!content) {
        throw new ApiError(400, "content is required.");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            content,
        },
        {
            new: true,
        },
    );

    if (!updatedTweet) {
        throw new ApiError(400, "Invalid tweetId.");
    }
    return res
        .status(201)
        .json(
            new ApiResponse(201, updatedTweet, "Tweet updated successfully."),
        );
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!tweetId) {
        throw new ApiError(400, "tweetId is required.");
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    if (!deletedTweet) {
        throw new ApiError(400, "Invalid tweetId.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
