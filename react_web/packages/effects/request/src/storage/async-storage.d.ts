/**
 * 类型声明文件：用于在 Web 环境中提供 @react-native-async-storage/async-storage 的类型声明
 * 这是一个可选依赖，在 Web 环境中可能不会被安装
 */
declare module '@react-native-async-storage/async-storage' {
  interface AsyncStorageStatic {
    getItem(
      key: string,
      callback?: (error?: Error, result?: string | null) => void
    ): Promise<string | null>;
    setItem(
      key: string,
      value: string,
      callback?: (error?: Error) => void
    ): Promise<void>;
    removeItem(
      key: string,
      callback?: (error?: Error) => void
    ): Promise<void>;
    clear(callback?: (error?: Error) => void): Promise<void>;
    getAllKeys(
      callback?: (error?: Error, keys?: string[]) => void
    ): Promise<string[]>;
    multiGet(
      keys: string[],
      callback?: (errors?: Error[], result?: [string, string | null][]) => void
    ): Promise<[string, string | null][]>;
    multiSet(
      keyValuePairs: [string, string][],
      callback?: (errors?: Error[]) => void
    ): Promise<void>;
    multiRemove(
      keys: string[],
      callback?: (errors?: Error[]) => void
    ): Promise<void>;
    mergeItem(
      key: string,
      value: string,
      callback?: (error?: Error) => void
    ): Promise<void>;
    multiMerge(
      keyValuePairs: [string, string][],
      callback?: (errors?: Error[]) => void
    ): Promise<void>;
    useAsyncStorage(key: string): {
      getItem: (
        callback?: (error?: Error, result?: string | null) => void
      ) => Promise<string | null>;
      setItem: (
        value: string,
        callback?: (error?: Error) => void
      ) => Promise<void>;
      removeItem: (callback?: (error?: Error) => void) => Promise<void>;
      mergeItem: (
        value: string,
        callback?: (error?: Error) => void
      ) => Promise<void>;
    };
  }

  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

