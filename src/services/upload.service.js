const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { s3 } = require("../config/s3");
require("dotenv").config();

const getMimeType = (ext) => {
    switch (ext.toLowerCase()) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".pdf":
            return "application/pdf";
        case ".doc":
            return "application/msword";
        case ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default:
            return "application/octet-stream";
    }
};

const uploadToS3 = async (fileBuffer, originalName) => {
    const folder = process.env.AWS_FOLDER_NAME; // fixed folder name
    const ext = path.extname(originalName);


    const filename = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filename,
        Body: fileBuffer,
        ContentType: getMimeType(ext),
    });
    await s3.send(command);
    const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
    return publicUrl;
};

module.exports = { uploadToS3, getMimeType };
