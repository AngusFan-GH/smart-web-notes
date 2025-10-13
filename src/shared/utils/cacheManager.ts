// 缓存管理器
export interface CacheItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  priority: "low" | "medium" | "high";
}

export interface CacheConfig {
  maxSize: number; // 最大缓存大小（字节）
  maxItems: number; // 最大缓存项数
  defaultTTL: number; // 默认过期时间（毫秒）
  cleanupInterval: number; // 清理间隔（毫秒）
  enableLRU: boolean; // 启用LRU淘汰策略
  enableCompression: boolean; // 启用压缩
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  lastCleanup: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheItem>();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isCleaning = false;

  private constructor() {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxItems: 1000,
      defaultTTL: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 60 * 1000, // 1分钟
      enableLRU: true,
      enableCompression: true,
    };

    this.stats = {
      totalItems: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0,
      lastCleanup: 0,
    };

    this.startCleanupTimer();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 设置缓存项
   */
  public set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      priority?: "low" | "medium" | "high";
      compress?: boolean;
    }
  ): void {
    const now = Date.now();
    const ttl = options?.ttl || this.config.defaultTTL;
    const priority = options?.priority || "medium";
    const compress = options?.compress ?? this.config.enableCompression;

    // 计算值的大小
    const serializedValue = JSON.stringify(value);
    const size = this.calculateSize(serializedValue, compress);

    // 检查是否需要清理空间
    if (this.shouldEvict(size)) {
      this.evictItems(size);
    }

    // 创建缓存项
    const item: CacheItem<T> = {
      key,
      value,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      size,
      priority,
    };

    // 如果存在旧项，先移除
    if (this.cache.has(key)) {
      this.removeItem(key);
    }

    // 添加新项
    this.cache.set(key, item);
    this.updateStats();
  }

  /**
   * 获取缓存项
   */
  public get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.removeItem(key);
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccessed = Date.now();
    this.stats.hitCount++;
    this.updateHitRate();

    return item.value;
  }

  /**
   * 检查缓存项是否存在
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.removeItem(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存项
   */
  public delete(key: string): boolean {
    return this.removeItem(key);
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存配置
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新缓存配置
   */
  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果配置了新的清理间隔，重启定时器
    if (newConfig.cleanupInterval) {
      this.restartCleanupTimer();
    }
  }

  /**
   * 手动清理过期项
   */
  public cleanup(): void {
    if (this.isCleaning) return;

    this.isCleaning = true;
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.updateStats();
    this.stats.lastCleanup = now;
    this.isCleaning = false;

    console.log(`缓存清理完成，清理了 ${cleanedCount} 个过期项`);
  }

  /**
   * 获取缓存大小信息
   */
  public getSizeInfo(): {
    totalSize: number;
    totalItems: number;
    averageItemSize: number;
    memoryUsage: number;
  } {
    const totalSize = this.stats.totalSize;
    const totalItems = this.stats.totalItems;
    const averageItemSize = totalItems > 0 ? totalSize / totalItems : 0;

    // 估算内存使用量（包括Map开销）
    const memoryUsage = totalSize + totalItems * 200; // 每个Map项约200字节开销

    return {
      totalSize,
      totalItems,
      averageItemSize,
      memoryUsage,
    };
  }

  /**
   * 导出缓存数据
   */
  public export(): string {
    const data = Array.from(this.cache.entries()).map(([key, item]) => ({
      key,
      value: item.value,
      timestamp: item.timestamp,
      expiresAt: item.expiresAt,
      priority: item.priority,
    }));

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入缓存数据
   */
  public import(data: string): void {
    try {
      const items = JSON.parse(data);

      for (const item of items) {
        const now = Date.now();
        const size = this.calculateSize(JSON.stringify(item.value));

        const cacheItem: CacheItem = {
          key: item.key,
          value: item.value,
          timestamp: item.timestamp,
          expiresAt: item.expiresAt,
          accessCount: 0,
          lastAccessed: now,
          size,
          priority: item.priority || "medium",
        };

        this.cache.set(item.key, cacheItem);
      }

      this.updateStats();
    } catch (error) {
      console.error("导入缓存数据失败:", error);
    }
  }

  /**
   * 销毁缓存管理器
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }

  /**
   * 计算值的大小
   */
  private calculateSize(value: string, compress = false): number {
    if (compress) {
      // 简单的压缩估算（实际压缩率约为30-50%）
      return Math.ceil(value.length * 0.4);
    }
    return value.length * 2; // UTF-16编码，每个字符2字节
  }

  /**
   * 检查是否需要淘汰项
   */
  private shouldEvict(newItemSize: number): boolean {
    return (
      this.stats.totalSize + newItemSize > this.config.maxSize ||
      this.stats.totalItems >= this.config.maxItems
    );
  }

  /**
   * 淘汰缓存项
   */
  private evictItems(requiredSpace: number): void {
    const items = Array.from(this.cache.values());
    let freedSpace = 0;
    let evictedCount = 0;

    if (this.config.enableLRU) {
      // LRU策略：按最后访问时间排序
      items.sort((a, b) => a.lastAccessed - b.lastAccessed);
    } else {
      // FIFO策略：按时间戳排序
      items.sort((a, b) => a.timestamp - b.timestamp);
    }

    // 按优先级分组
    const priorityGroups = {
      low: items.filter((item) => item.priority === "low"),
      medium: items.filter((item) => item.priority === "medium"),
      high: items.filter((item) => item.priority === "high"),
    };

    // 按优先级顺序淘汰
    const priorityOrder: ("low" | "medium" | "high")[] = [
      "low",
      "medium",
      "high",
    ];

    for (const priority of priorityOrder) {
      for (const item of priorityGroups[priority]) {
        if (freedSpace >= requiredSpace) break;

        this.cache.delete(item.key);
        freedSpace += item.size;
        evictedCount++;
      }

      if (freedSpace >= requiredSpace) break;
    }

    this.stats.evictionCount += evictedCount;
    this.updateStats();
  }

  /**
   * 移除缓存项
   */
  private removeItem(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    this.cache.delete(key);
    this.updateStats();
    return true;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    let totalSize = 0;
    let totalItems = 0;

    for (const item of this.cache.values()) {
      totalSize += item.size;
      totalItems++;
    }

    this.stats.totalSize = totalSize;
    this.stats.totalItems = totalItems;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? (this.stats.hitCount / total) * 100 : 0;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 重启清理定时器
   */
  private restartCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.startCleanupTimer();
  }
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance();

// 便捷函数
export function setCache<T>(key: string, value: T, options?: any): void {
  cacheManager.set(key, value, options);
}

export function getCache<T>(key: string): T | null {
  return cacheManager.get<T>(key);
}

export function hasCache(key: string): boolean {
  return cacheManager.has(key);
}

export function deleteCache(key: string): boolean {
  return cacheManager.delete(key);
}

export function clearCache(): void {
  cacheManager.clear();
}

export function getCacheStats(): CacheStats {
  return cacheManager.getStats();
}
