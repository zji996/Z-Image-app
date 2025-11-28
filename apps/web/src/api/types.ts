export interface GenerateImageRequest {
  prompt: str;
  height?: number;
  width?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number | null;
}

export interface GenerateImageResponse {
  task_id: string;
}

export interface TaskResult {
  image_id: string;
  prompt: string;
  height: number;
  width: number;
  num_inference_steps: number;
  guidance_scale: number;
  seed: number | null;
  created_at: string;
  output_path: string;
  relative_path: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED";
  result?: TaskResult;
  error?: string;
}
