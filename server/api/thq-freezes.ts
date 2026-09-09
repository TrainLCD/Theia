import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { fetchThqFreezes, parseFreezeQuery } from "../utils/thqFreeze";

// スナップショットと同じく常に 200 で { freezes, sessions, summary, lines, error? } を返す。
// クライアントは error の有無で「該当なし」と「取得失敗」を区別する。
export default defineHandler(async (event) => {
  const parsed = parseFreezeQuery(
    getQuery(event) as Record<string, string | undefined>,
    Date.now(),
  );
  if ("error" in parsed) {
    return { freezes: [], sessions: [], summary: [], lines: [], error: parsed.error };
  }
  return await fetchThqFreezes(parsed.filter);
});
