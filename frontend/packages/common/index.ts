// 公共工具与类型的入口，可按需扩展

export type ApiResponse<T = unknown> = {
  code?: number;
  message?: string;
  data?: T;
};

/**
 * Performs no operation.
 *
 * This function intentionally does nothing and exists as a callable placeholder.
 */
export function noop(): void {
  // intentionally empty
}
