import { GenerateImageRequest, GenerateImageResponse, TaskStatusResponse } from "./types";

export const generateImage = async (request: GenerateImageRequest): Promise<GenerateImageResponse> => {
  const response = await fetch("/v1/images/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Error generating image: ${response.statusText}`);
  }

  return response.json();
};

export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
  const response = await fetch(`/v1/tasks/${taskId}`);

  if (!response.ok) {
    throw new Error(`Error getting task status: ${response.statusText}`);
  }

  return response.json();
};

export const getImageUrl = (relativePath: string): string => {
  return `/generated-images/${relativePath}`;
};
