import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteFile, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserRefactor } from "../utils/userRefactor.js";

const cookieOptions = {
    httpOnly: true,
    secure: true,
};

const generateAccessAndRefereshTokens = async (user) => {
    try {
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating referesh and access token",
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    /**
     * get user details from request body
     * validate user details
     * check if user already exists by username and  email
     * check for images, check for avatar
     * upload images to cloudinary
     *  create user object
     * check for user creation
     * remove password and refresh token field from user object
     * return response
     */

    // get user details from request body
    const { fullName, email, username, password } = req.body;

    // validate user details
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === "" || field?.trim() === undefined,
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // check if user already exists by username and  email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    // if user already exist then return error
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    let avatarLocalPath;
    let coverImageLocalPath;

    // get cover images
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // check for avatar
    if (
        req.files &&
        Array.isArray(req.files.avatar) &&
        req.files.avatar.length > 0
    ) {
        avatarLocalPath = req.files.avatar[0].path;
    } else {
        throw new ApiError(400, "Avatar is required");
    }

    // upload images to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    // create user object
    let user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    // check for user creation
    if (!user) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user",
        );
    }

    // remove password and refresh token field from user object
    user = new UserRefactor(user);

    // return response
    return res
        .status(201)
        .json(new ApiResponse(200, user, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    /**
     * get username or email and password from request body
     * validate email or username is exist
     * Find the user
     *  - check user exist
     *  - if user doesn't exist then send error
     * compare password
     *  - if password doesn't match send error
     * generate refresh and access token
     * remove password and refresh token from user object
     * set tokens in cookie
     * send response with user details and tokens
     */

    // get data from request body
    const { email, username, password } = req.body;

    // validate email or username is exist
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required.");
    }

    // Find the user
    let user = await User.findOne({
        $or: [{ username }, { email }],
    });

    /**
     *  check user exist
     *  if user doesn't exist then send error
     */
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // compare password
    const isPasswordValid = await user.isPasswordCorrect(password);

    // if password doesn't match send error
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // generate refresh and access token
    const { accessToken, refreshToken } =
        await generateAccessAndRefereshTokens(user);

    // remove password and refresh token
    user = new UserRefactor(user);

    // send response
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions) // set tokens in cookie
        .cookie("refreshToken", refreshToken, cookieOptions) // set tokens in cookie
        .json(
            new ApiResponse(
                200,
                {
                    user,
                    accessToken,
                    refreshToken,
                },
                "User logged In Successfully",
            ),
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    /**
     * remove refresh token from DB
     * clear tokens from cookies
     */

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        },
    );

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    /**
     * get refresh token from cookie or body
     * decode refresh token
     * find user by decoded token
     *  - if user doesn't exist then throw error
     * compare incoming refresh token and DB refresh token
     * generate new tokens
     * set new tokens in cookie
     * send response with tokens
     */

    // get refresh token from cookie or body
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    try {
        // decode refresh token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        );

        // find user by decoded token
        const user = await User.findById(decodedToken?._id);

        // if user doesn't exist then throw error
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // compare incoming refresh token and DB refresh token
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        // generate new tokens
        const { accessToken, refreshToken } =
            await generateAccessAndRefereshTokens(user);

        /**
         * set new tokens in cookie
         * send response with tokens
         */
        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access token refreshed",
                ),
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    /**
     * Get old and new passwords from user
     * find user by ID
     * compare both password (old password from user and password from DB)
     * change password
     */

    // Get old and new passwords from user
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "old and new passwords required");
    }
    // find user by ID
    const user = await User.findById(req.user?._id);

    // compare password
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    // change password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    /**
     * get fullName and email from user
     * validate fullName and email
     * check email is already used
     * update fields
     * return updated response
     */

    // get fullName and email from user
    const { fullName, email } = req.body;

    // validate fullName and email
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    // check email is already used
    const isEmailUsed = await User.find({
        email,
        $nor: [{ _id: req.user._id }],
    });

    if (isEmailUsed?.[0]) {
        throw new ApiError(400, "Email is already used");
    }

    // update fields
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
            },
        },
        { new: true },
    ).select("-password -refreshToken");

    // return updated response
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully"),
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    /**
     * get new avatar
     * delete old avatar
     * upload new avatar
     * update new avatar url in db
     * return updated profile
     */

    let avatarLocalPath;

    // check for avatar
    if (req.file && req.file.path) {
        avatarLocalPath = req.file.path;
    } else {
        throw new ApiError(400, "Avatar is required");
    }

    /**
     * delete old image
     */

    deleteFile(req.user.avatar);

    // upload new avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar");
    }

    // update new avatar url in db
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true },
    ).select("-password -refreshToken");

    // return updated profile
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    /**
     * get new coverImage
     * delete old coverImage
     * upload new coverImage
     * update new coverImage url in db
     * return updated profile
     */

    let coverImageLocalPath;

    // check for file
    if (req.file && req.file.path) {
        coverImageLocalPath = req.file.path;
    } else {
        throw new ApiError(400, "coverImage is required");
    }

    /**
     * delete old image
     */

    if (req.user.coverImage) {
        deleteFile(req.user.coverImage);
    }

    // upload new covee image
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage");
    }

    // update new cover url in db
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true },
    ).select("-password -refreshToken");

    // return updated profile
    return res
        .status(200)
        .json(new ApiResponse(200, user, "cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers",
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "User channel fetched successfully",
            ),
        );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
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
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully",
            ),
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
};
