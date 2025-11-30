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
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED";
  result?: TaskResult;
  error?: string;
  error_code?: string | null;
  error_hint?: string | null;
  image_url?: string | null;
}

export interface TaskSummary {
  task_id: string;
  status: string;
  created_at?: string;
  prompt?: string;
  height?: number;
  width?: number;
  relative_path?: string;
  image_url?: string | null;
}

export interface CancelTaskResponse {
  task_id: string;
  status: string;
  message?: string;
}
