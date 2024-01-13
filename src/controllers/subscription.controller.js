import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    /**
     * To toggle subscription
     * first find channel by both channelId and subscriberId(logged In user)
     * if subscription exist then delete subscription
     * if subscription doesn't exist then create subscription
     */

    if (!channelId) {
        throw new ApiError(400, "ChannelId is required.");
    }

    const subscription = await Subscription.findOne({
        $and: [
            {
                subscriber: req.user._id,
            },
            {
                channel: channelId,
            },
        ],
    });

    if (!subscription) {
        const subscribed = await Subscription.create({
            subscriber: req.user._id,
            channel: channelId,
        });

        if (!subscribed) {
            throw new ApiError(500, "Something went wrong while subscribing");
        }

        return res
            .status(201)
            .json(new ApiResponse(201, {}, "subscribed successfully"));
    }

    const unSubscribe = await Subscription.findOneAndDelete({
        $and: [
            {
                subscriber: req.user._id,
            },
            {
                channel: channelId,
            },
        ],
    });

    if (!unSubscribe) {
        throw new ApiError(500, "Something went wrong while unsubscribing");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Unsubscribed successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!channelId) {
        throw new ApiError(400, "channelId is required.");
    }

    const subscribers = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(channelId),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            foreignField: "_id",
                            localField: "subscriber",
                            as: "subscriber",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                        coverImage: 1,
                                        email: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            subscriber: {
                                $first: "$subscriber",
                            },
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                total: {
                    $size: "$subscribers",
                },
                subscribers: "$subscribers.subscriber",
            },
        },

        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                subscribers: 1,
                total: 1,
            },
        },
    ]);

    if (!subscribers?.[0]) {
        throw new ApiError(400, "Invalid channelId");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: subscribers[0],
            },
            "subscribers list.",
        ),
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    if (!subscriberId) {
        throw new ApiError(400, "SubscriberId is required.");
    }

    const subscribedList = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(subscriberId),
            },
        },

        {
            $lookup: {
                from: "subscriptions",
                foreignField: "subscriber",
                localField: "_id",
                as: "channels",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            foreignField: "_id",
                            localField: "channel",
                            as: "channel",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                        coverImage: 1,
                                        email: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            channel: {
                                $first: "$channel",
                            },
                        },
                    },
                ],
            },
        },

        {
            $addFields: {
                total: {
                    $size: "$channels",
                },
                channels: "$channels.channel",
            },
        },

        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                channels: 1,
                total: 1,
            },
        },
    ]);

    if (!subscribedList?.[0]) {
        throw new ApiError(400, "invalid subsriberId");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: subscribedList[0],
            },
            "subscribed channel list",
        ),
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
