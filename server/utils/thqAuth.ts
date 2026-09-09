// THQ の観測用トークン (THQ サーバー側の THQ_OBSERVER_AUTH_TOKEN)。
// WebSocket 購読・履歴取得 Query・欠落検出 Query のすべてがこの 1 本で足りる。
// THQ_WS_TOKEN は WebSocket 専用だった頃の旧名で、既存デプロイのための後方互換。
// .env.example をそのままコピーすると THQ_OBSERVER_TOKEN は空文字になるため、
// ?? ではなく || で「値が入っているか」を見る。
export const THQ_OBSERVER_TOKEN = process.env.THQ_OBSERVER_TOKEN || process.env.THQ_WS_TOKEN;

export const THQ_GRAPHQL_URL = process.env.THQ_GRAPHQL_URL ?? "https://thq.trainlcd.app/graphql";
