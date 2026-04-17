import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

// 🔁 Your Cloudinary credentials
const CLOUD_NAME = 'dqnsnt7pg';
const UPLOAD_PRESET = 'bloodlink_profile_preset';

// Separate folders for different types of uploads
const PROFILE_FOLDER = 'bloodlink_profiles';
const CERTIFICATE_FOLDER = 'bloodlink_certificates';
const EVIDENCE_FOLDER = 'bloodlink_report_evidence';

/**
 * Internal function – uploads an image to Cloudinary into the specified folder
 */
const uploadToCloudinary = async (uri: string, folder: string): Promise<string> => {
  try {
    // 1. Compress and resize the image
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append('file', {
      uri: manipulatedImage.uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    // 3. Upload
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    return response.data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
};

// Public functions – use these in your components
export const uploadProfilePicture = (uri: string) => uploadToCloudinary(uri, PROFILE_FOLDER);
export const uploadCertificate = (uri: string) => uploadToCloudinary(uri, CERTIFICATE_FOLDER);
export const uploadReportEvidence = (uri: string) => uploadToCloudinary(uri, EVIDENCE_FOLDER);
