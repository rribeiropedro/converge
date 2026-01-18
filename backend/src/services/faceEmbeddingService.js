import * as faceapi from '@vladmandic/face-api';
import canvas from 'canvas';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const { Canvas, Image, ImageData, loadImage } = canvas;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_URL = path.join(__dirname, '../../face-api-models');

faceapi.env.monkeyPatch({
  Canvas,
  Image,
  ImageData,
  fetch
});

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  
  console.log('Loading face-api.js models from:', MODEL_URL);
  try {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL);
    console.log('face-api.js models loaded successfully.');
    modelsLoaded = true;
  } catch (error) {
    console.error('Failed to load face-api.js models:', error);
    throw new Error('Face-API models failed to load. Ensure they are in ' + MODEL_URL);
  }
}

export async function generateFaceEmbedding(imageData) {
  await loadModels();

  let img;
  if (imageData.startsWith('data:image')) {
    const base64Data = imageData.split(',')[1];
    img = new Image();
    img.src = Buffer.from(base64Data, 'base64');
  } else if (imageData.startsWith('http')) {
    try {
      img = await loadImage(imageData);
    } catch (error) {
      throw new Error(`Failed to load image from URL: ${imageData}. Error: ${error.message}`);
    }
  } else {
    throw new Error('Unsupported image data format. Must be base64 data URI or URL.');
  }

  const detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();

  if (!detections || !detections.descriptor) {
    throw new Error('No face detected or descriptor could not be computed in the provided image.');
  }

  return Array.from(detections.descriptor);
}

export function calculateCosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== 128 || embedding2.length !== 128) {
    return 0;
  }

  const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
  const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}
