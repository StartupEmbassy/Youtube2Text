type CatalogMetricsSnapshot = {
  cacheHit: number;
  cacheMiss: number;
  cacheExpired: number;
  fullRefresh: number;
  incrementalRefresh: number;
  incrementalAddedVideos: number;
};

let cacheHit = 0;
let cacheMiss = 0;
let cacheExpired = 0;
let fullRefresh = 0;
let incrementalRefresh = 0;
let incrementalAddedVideos = 0;

export function incCatalogCacheHit() {
  cacheHit++;
}

export function incCatalogCacheMiss() {
  cacheMiss++;
}

export function incCatalogCacheExpired() {
  cacheExpired++;
}

export function incCatalogFullRefresh() {
  fullRefresh++;
}

export function incCatalogIncrementalRefresh(addedVideos: number) {
  incrementalRefresh++;
  if (Number.isFinite(addedVideos) && addedVideos > 0) {
    incrementalAddedVideos += Math.trunc(addedVideos);
  }
}

export function getCatalogMetricsSnapshot(): CatalogMetricsSnapshot {
  return {
    cacheHit,
    cacheMiss,
    cacheExpired,
    fullRefresh,
    incrementalRefresh,
    incrementalAddedVideos,
  };
}

export function resetCatalogMetricsForTests() {
  cacheHit = 0;
  cacheMiss = 0;
  cacheExpired = 0;
  fullRefresh = 0;
  incrementalRefresh = 0;
  incrementalAddedVideos = 0;
}

