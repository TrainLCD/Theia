import { defineHandler } from "nitro";
import { isMethod, readBody } from "nitro/h3";
import { parseTriageBody, triageAlerts } from "../utils/alertTriage";

// スナップショットや欠落検出と同じく常に 200 で { judgements, error? } を返す。
// 判定が付かなくてもアラート表示自体は成立するので、クライアントは error を見て
// トリアージの軸だけ落とす。API キーはこのハンドラの中だけで使い、ブラウザには出さない。
export default defineHandler(async (event) => {
  if (!isMethod(event, "POST")) return { judgements: [], error: "POST only" };
  const parsed = parseTriageBody(await readBody(event));
  if ("error" in parsed) return { judgements: [], error: parsed.error };
  return await triageAlerts(parsed.signatures);
});
