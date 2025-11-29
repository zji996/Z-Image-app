import { GenerateImageRequest, GenerateImageResponse, TaskStatusResponse, TaskSummary } from "./types";

const buildHeaders = (authKey?: string): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (authKey) {
    headers["X-Auth-Key"] = authKey;
  }
  return headers;
};

export const generateImage = async (
  request: GenerateImageRequest,
  authKey?: string,
): Promise<GenerateImageResponse> => {
  const response = await fetch("/v1/images/generate", {
    method: "POST",
    headers: buildHeaders(authKey),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Error generating image: ${response.statusText}`);
  }

  return response.json() as Promise<GenerateImageResponse>;
};

export const getTaskStatus = async (taskId: string, authKey?: string): Promise<TaskStatusResponse> => {
  const response = await fetch(`/v1/tasks/${taskId}`, {
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new Error(`Error getting task status: ${response.statusText}`);
  }

  return response.json() as Promise<TaskStatusResponse>;
};

export const getImageUrl = (relativePath: string): string => {
  return `/generated-images/${relativePath}`;
};

export const getHistory = async (authKey?: string, limit = 20): Promise<TaskSummary[]> => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  const response = await fetch(`/v1/history?${params.toString()}`, {
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new Error(`Error fetching history: ${response.statusText}`);
  }

  return response.json() as Promise<TaskSummary[]>;
};
