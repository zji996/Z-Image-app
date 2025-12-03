import {
  BatchDetail,
  BatchSummary,
  CancelTaskResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  TaskStatusResponse,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

export const getImageUrl = (relativePathOrUrl: string): string => {
  // If backend already returned a full or relative URL, use it directly.
  if (relativePathOrUrl.startsWith("/")) {
    return relativePathOrUrl;
  }
  // Fallback to constructing from relative_path.
  return `/generated-images/${relativePathOrUrl}`;
};

/**
 * 将预览 URL（可能是 webp）转换为下载用的 PNG URL
 * 用于下载按钮，确保用户下载的是原始 PNG 而不是压缩后的 webp
 */
export const getDownloadUrl = (imageUrl: string): string => {
  if (!imageUrl) return "#";
  const [base, query] = imageUrl.split("?");
  if (base.toLowerCase().endsWith(".webp")) {
    const pngBase = `${base.slice(0, -5)}.png`;
    return query ? `${pngBase}?${query}` : pngBase;
  }
  return imageUrl;
};

/**
 * 获取历史批次列表
 */
export const getHistory = async (authKey?: string, limit = 20, offset = 0): Promise<BatchSummary[]> => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(Math.max(offset, 0)));

  const response = await fetch(`/v1/history?${params.toString()}`, {
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new ApiError(`Error fetching history: ${response.statusText}`, response.status);
  }

  return response.json() as Promise<BatchSummary[]>;
};

/**
 * 获取批次详情，包含批次内所有图片状态
 */
export const getBatchDetail = async (batchId: string, authKey?: string): Promise<BatchDetail> => {
  const response = await fetch(`/v1/history/${batchId}`, {
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new ApiError(`Error fetching batch detail: ${response.statusText}`, response.status);
  }

  return response.json() as Promise<BatchDetail>;
};

export const cancelTask = async (taskId: string, authKey?: string): Promise<CancelTaskResponse> => {
  const response = await fetch(`/v1/tasks/${taskId}/cancel`, {
    method: "POST",
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new ApiError(`Error cancelling task: ${response.statusText}`, response.status);
  }

  return response.json() as Promise<CancelTaskResponse>;
};

export const deleteHistoryItem = async (batchId: string, authKey?: string): Promise<void> => {
  const response = await fetch(`/v1/history/${batchId}`, {
    method: "DELETE",
    headers: buildHeaders(authKey),
  });

  if (!response.ok) {
    throw new ApiError(`Error deleting batch: ${response.statusText}`, response.status);
  }
};
