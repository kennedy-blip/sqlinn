export interface QueryPreset {
  id: string;
  name: string;
  category: "Aggregation" | "JOIN" | "Funnel" | "Diagnostic";
  description: string;
  sql: string;
}

export const QUERY_PRESETS: QueryPreset[] = [
  {
    id: "power-users",
    name: "Top power users",
    category: "JOIN",
    description: "Most successful API requests per account",
    sql: `SELECT
  u.full_name,
  u.plan,
  COUNT(l.id) AS requests,
  ROUND(AVG(l.latency_ms), 1) AS avg_latency_ms
FROM users u
JOIN api_logs l ON u.id = l.user_id
WHERE l.status_code = 200
GROUP BY u.id, u.full_name, u.plan
ORDER BY requests DESC
LIMIT 12;`,
  },
  {
    id: "plan-performance",
    name: "Plan performance",
    category: "Aggregation",
    description: "Query volume and storage by subscription tier",
    sql: `SELECT
  plan,
  COUNT(*) AS accounts,
  SUM(monthly_queries) AS total_queries,
  ROUND(AVG(storage_mb), 1) AS avg_storage_mb
FROM users
WHERE status != 'suspended'
GROUP BY plan
ORDER BY total_queries DESC;`,
  },
  {
    id: "endpoint-errors",
    name: "Endpoint error rate",
    category: "Funnel",
    description: "Failure percentage across edge endpoints",
    sql: `SELECT
  endpoint,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
  ROUND(100.0 * SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) / COUNT(*), 2) AS error_rate_pct
FROM api_logs
GROUP BY endpoint
ORDER BY error_rate_pct DESC;`,
  },
  {
    id: "latency-regions",
    name: "Latency by region",
    category: "Aggregation",
    description: "Edge latency profile from February traffic",
    sql: `SELECT
  region,
  COUNT(*) AS requests,
  ROUND(AVG(latency_ms), 1) AS avg_latency_ms,
  MAX(latency_ms) AS slowest_ms
FROM api_logs
WHERE created_at >= '2026-02-09'
GROUP BY region
HAVING COUNT(*) > 20
ORDER BY avg_latency_ms DESC;`,
  },
  {
    id: "embedding-inventory",
    name: "Embedding inventory",
    category: "Aggregation",
    description: "Vector collections and token consumption",
    sql: `SELECT
  model,
  COUNT(*) AS collections,
  ROUND(AVG(dimensions), 0) AS avg_dimensions,
  SUM(tokens_used) AS total_tokens
FROM embeddings_meta
GROUP BY model
ORDER BY total_tokens DESC;`,
  },
  {
    id: "dormant-accounts",
    name: "Dormant accounts",
    category: "Diagnostic",
    description: "Active accounts that have gone quiet",
    sql: `SELECT
  full_name,
  email,
  plan,
  last_active_at
FROM users
WHERE status = 'active'
  AND last_active_at < '2026-01-20'
ORDER BY last_active_at ASC
LIMIT 20;`,
  },
  {
    id: "vector-ownership",
    name: "Vector ownership",
    category: "JOIN",
    description: "Left-join collections onto every active account",
    sql: `SELECT
  u.full_name,
  u.plan,
  COUNT(e.id) AS collections,
  SUM(e.tokens_used) AS tokens_used
FROM users u
LEFT JOIN embeddings_meta e ON u.id = e.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.full_name, u.plan
ORDER BY tokens_used DESC
LIMIT 10;`,
  },
  {
    id: "slow-requests",
    name: "Slow request trace",
    category: "Diagnostic",
    description: "Inspect outlier requests above 300ms",
    sql: `SELECT *
FROM api_logs
WHERE latency_ms > 300
ORDER BY latency_ms DESC
LIMIT 40;`,
  },
];

export const INITIAL_QUERY = QUERY_PRESETS[0].sql;
