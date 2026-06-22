import type { ErrorDef, LineDef, TrainTypeDef } from "./types";

export const TIME_SCALE = 20;

export const LINE_DEFS: LineDef[] = [
  {
    id: "too",
    name: "東央本線",
    color: "#3b82f6",
    lengthKm: 34,
    maxSpeed: 120,
    stations: [
      "中央港",
      "桜橋",
      "神宮前",
      "緑園都市",
      "高瀬",
      "北野",
      "川島",
      "湊町",
      "東雲",
      "海神",
    ],
  },
  {
    id: "kita",
    name: "北環状線",
    color: "#10b981",
    lengthKm: 28,
    maxSpeed: 100,
    stations: ["環状本町", "大門", "弥生台", "杜の宮", "白幡", "花園", "鶴見ヶ丘", "美原", "東環"],
  },
  {
    id: "sei",
    name: "西海岸線",
    color: "#06b6d4",
    lengthKm: 31,
    maxSpeed: 110,
    stations: ["西浜", "潮見", "灯台前", "砂丘公園", "漁港", "岬町", "真名瀬", "白波", "夕陽ヶ浦"],
  },
  {
    id: "chu",
    name: "中部高速線",
    color: "#f59e0b",
    lengthKm: 46,
    maxSpeed: 160,
    stations: [
      "中央ターミナル",
      "工業団地",
      "空港北",
      "学園都市",
      "新都心",
      "山手",
      "渓谷口",
      "高原",
    ],
  },
  {
    id: "nan",
    name: "南部支線",
    color: "#a78bfa",
    lengthKm: 18,
    maxSpeed: 85,
    stations: ["南口", "田園", "古市", "蓮池", "霞ヶ岡", "終ヶ谷"],
  },
  {
    id: "wan",
    name: "湾岸線",
    color: "#f43f5e",
    lengthKm: 24,
    maxSpeed: 95,
    stations: [
      "港湾一号",
      "コンテナ埠頭",
      "海浜公園",
      "観覧車前",
      "国際展示場",
      "お台南",
      "青海口",
      "有楼",
    ],
  },
];

export const LINE_MAP: Record<string, LineDef> = Object.fromEntries(
  LINE_DEFS.map((l) => [l.id, l]),
);

export const TRAIN_TYPES: TrainTypeDef[] = [
  { t: "各停", c: "#94a3b8" },
  { t: "快速", c: "#38bdf8" },
  { t: "特急", c: "#fbbf24" },
];

export const ERROR_DEFS: ErrorDef[] = [
  { code: "E-114", label: "GPS測位ロスト", sev: "E" },
  { code: "E-201", label: "速度センサ異常", sev: "E" },
  { code: "E-330", label: "車上装置通信断", sev: "E" },
  { code: "E-275", label: "力行回路過電流", sev: "E" },
  { code: "W-052", label: "ATS-P応答遅延", sev: "W" },
  { code: "W-018", label: "ドア開閉検知異常", sev: "W" },
  { code: "W-061", label: "勾配区間速度超過警告", sev: "W" },
  { code: "W-033", label: "測位信頼度低下", sev: "W" },
];
