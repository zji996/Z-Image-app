import { getImageUrl } from "../api/client";
import type { BatchItemDetail, BatchSummary, ImageSelectionInfo } from "../api/types";

/**
 * 从批次摘要构建图片选择信息
 * 用于从历史记录加载到 Studio
 */
export function buildSelectionInfoFromBatch(batch: BatchSummary): ImageSelectionInfo | null {
  const imageUrl = batch.image_url
    ? getImageUrl(batch.image_url)
    : batch.relative_path
      ? getImageUrl(batch.relative_path)
      : null;

  if (!imageUrl) return null;

  return {
    imageUrl,
    batchId: batch.task_id,
    batchSize: batch.batch_size,
    successCount: batch.success_count,
    failedCount: batch.failed_count,
    prompt: batch.prompt,
    width: batch.width,
    height: batch.height,
    steps: batch.num_inference_steps,
    guidance: batch.guidance_scale,
    seed: batch.base_seed,
  };
}

/**
 * 从批次详情项构建图片选择信息
 * 用于在批次详情模态框中选择具体图片
 */
export function buildSelectionInfoFromDetail(
  batch: BatchSummary,
  item?: BatchItemDetail
): ImageSelectionInfo | null {
  if (!item?.image_url) return null;

  return {
    imageUrl: getImageUrl(item.image_url),
    batchId: batch.task_id,
    taskId: item.task_id,
    batchSize: batch.batch_size,
    successCount: batch.success_count,
    failedCount: batch.failed_count,
    prompt: batch.prompt,
    width: item.width || batch.width,
    height: item.height || batch.height,
    steps: batch.num_inference_steps,
    guidance: batch.guidance_scale,
    seed: item.seed ?? batch.base_seed,
  };
}

