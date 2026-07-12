import { defineHandler } from "nitro";
import { fetchThqSnapshot } from "../utils/thqGraphql";

// 常に 200 で { messages, error? } を返す。クライアントは error の有無で
// 「イベントが無い」と「取得に失敗した」を区別し、失敗時はライブのみで継続する。
export default defineHandler(() => fetchThqSnapshot());
