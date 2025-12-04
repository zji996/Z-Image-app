import { memo, useState, useCallback, type ImgHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** 是否显示加载状态 */
  showLoader?: boolean;
  /** 加载器的大小 */
  loaderSize?: number;
  /** 加载器的颜色类名 */
  loaderClassName?: string;
  /** 图片加载失败时的回调 */
  onLoadError?: () => void;
}

/**
 * 缓存优化的图片组件
 * - 使用 React.memo 确保只有 src 变化时才重新渲染
 * - 避免父组件重新渲染导致的图片重复加载
 */
export const CachedImage = memo(
  function CachedImage({
    src,
    alt,
    className,
    showLoader = false,
    loaderSize = 24,
    loaderClassName = "text-stone-400",
    onLoadError,
    onLoad,
    onError,
    ...props
  }: CachedImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = useCallback(
      (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoading(false);
        setHasError(false);
        onLoad?.(e);
      },
      [onLoad]
    );

    const handleError = useCallback(
      (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoading(false);
        setHasError(true);
        onLoadError?.();
        onError?.(e);
      },
      [onError, onLoadError]
    );

    if (!src) {
      return null;
    }

    return (
      <>
        {showLoader && isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-100/50">
            <Loader2 size={loaderSize} className={`animate-spin ${loaderClassName}`} />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className={className}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </>
    );
  },
  // 自定义比较函数：只有 src 变化时才重新渲染
  (prevProps, nextProps) => {
    // 如果 src 相同，不需要重新渲染
    if (prevProps.src === nextProps.src) {
      // 但如果其他关键属性变了，还是要渲染
      return (
        prevProps.className === nextProps.className &&
        prevProps.alt === nextProps.alt
      );
    }
    return false;
  }
);

export default CachedImage;

