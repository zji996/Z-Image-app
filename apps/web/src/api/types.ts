export interface GenerateImageRequest {
  prompt: string;
  height?: number;
  width?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number | null;
  negative_prompt?: string | null;
  cfg_normalization?: boolean | null;
  cfg_truncation?: number | null;
  max_sequence_length?: number | null;
  metadata?: Record<string, unknown>;
}

export interface GenerateImageResponse {
  task_id: string;
  status_url: string;
  image_url: string | null;
}

export interface TaskResult {
  image_id: string;
  prompt: string;
  height: number;
  width: number;
  num_inference_steps: number;
  guidance_scale: number;
  seed: number | null;
  negative_prompt: string | null;
  cfg_normalization: boolean | null;
  cfg_truncation: number | null;
  max_sequence_length: number | null;
  created_at: string;
  auth_key: string | null;
  metadata: Record<string, unknown>;
  output_path: string;
  relative_path: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED" | "PROGRESS";
  result?: TaskResult;
  error?: string;
  error_code?: string | null;
  error_hint?: string | null;
  image_url?: string | null;
  progress?: number;
}

/**
 * 批次摘要，对应 /v1/history 返回的单个条目
 * task_id 实际上是 batch_id（为了兼容前端类型命名）
 */
export interface BatchSummary {
  task_id: string; // 实际是 batch_id
  status: "SUCCESS" | "FAILURE" | "PENDING";
  created_at?: string;
  prompt?: string;
  height?: number;
  width?: number;
  relative_path?: string;
  image_url?: string | null;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number | null;
  negative_prompt?: string | null;
  batch_size?: number;
  success_count?: number;
  failed_count?: number;
  base_seed?: number | null;
}

/**
 * 批次内单个图片的状态，对应 /v1/history/{batch_id} 返回的 items 数组元素
 */
export interface BatchItemDetail {
  task_id: string;
  index: number;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  image_url?: string | null;
  width?: number;
  height?: number;
  seed?: number | null;
  error_code?: string | null;
  error_hint?: string | null;
  progress?: number | null; // 任务进度（0-100），仅在 status 为 running 时有意义
}

/**
 * 批次详情，对应 /v1/history/{batch_id} 返回的完整响应
 */
export interface BatchDetail {
  batch: BatchSummary;
  items: BatchItemDetail[];
}

/** 选中图片时携带的完整信息 */
export interface ImageSelectionInfo {
  imageUrl: string;
  batchId?: string;
  taskId?: string;
  batchSize?: number;
  successCount?: number;
  failedCount?: number;
  prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number | null;
}

export interface CancelTaskResponse {
  task_id: string;
  status: string;
  message?: string;
}

/** 批次项状态 */
export type BatchItemStatus = "pending" | "running" | "success" | "error" | "cancelled";

/**
 * 前端使用的批次项，与后端 BatchItemDetail 对应但更易用
 */
export interface BatchItem {
  taskId: string;
  index: number;
  status: BatchItemStatus;
  imageUrl?: string;
  width?: number;
  height?: number;
  seed?: number | null;
  errorCode?: string | null;
  errorHint?: string | null;
  progress?: number;
}

/** 生成状态 */
export type GenerationStatus = "idle" | "pending" | "generating" | "success" | "error";

/** 历史记录错误类型 */
export type HistoryError = "unauthorized" | "unknown" | null;
