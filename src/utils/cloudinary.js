import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        /**
         * Upload the file on cloudinary
         */
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        /**
         * File has successfully uploaded
         */

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        /**
         * remove the locally saved temp file on failed
         */
        fs.unlinkSync(localFilePath);
        return null;
    }
};

const deleteFile = async (url) => {
    let fileUrl = url.split("/");
    let publicId = fileUrl[fileUrl.length - 1].split(".")[0];

    cloudinary.uploader.destroy(publicId, function (result) {
        console.log(result);
    });
};
export { uploadOnCloudinary, deleteFile };
