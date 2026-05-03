import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const DEFAULT_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const PROFILE_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_PROFILE_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET;
const CERTIFICATE_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_CERTIFICATE_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET;
const EVIDENCE_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_EVIDENCE_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET;

const PROFILE_FOLDER =
  process.env.EXPO_PUBLIC_CLOUDINARY_PROFILE_FOLDER || 'bloodlink_profiles';
const CERTIFICATE_FOLDER =
  process.env.EXPO_PUBLIC_CLOUDINARY_CERTIFICATE_FOLDER || 'bloodlink_certificates';
const EVIDENCE_FOLDER =
  process.env.EXPO_PUBLIC_CLOUDINARY_EVIDENCE_FOLDER || 'bloodlink_report_evidence';

if (!CLOUD_NAME || !PROFILE_UPLOAD_PRESET || !CERTIFICATE_UPLOAD_PRESET || !EVIDENCE_UPLOAD_PRESET) {
  throw new Error(
    "Missing required Cloudinary environment variables. Check .env and EXPO_PUBLIC_CLOUDINARY_* values."
  );
}

/**
 * Internal function – uploads an image to Cloudinary into the specified folder/preset
 */
const uploadToCloudinary = async (
  uri: string,
  folder: string,
  uploadPreset: string
): Promise<string> => {
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
    formData.append('upload_preset', uploadPreset);
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
export const uploadProfilePicture = (uri: string) =>
  uploadToCloudinary(uri, PROFILE_FOLDER, PROFILE_UPLOAD_PRESET);
export const uploadCertificate = (uri: string) =>
  uploadToCloudinary(uri, CERTIFICATE_FOLDER, CERTIFICATE_UPLOAD_PRESET);
export const uploadReportEvidence = (uri: string) =>
  uploadToCloudinary(uri, EVIDENCE_FOLDER, EVIDENCE_UPLOAD_PRESET);
