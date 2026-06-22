import { defineHandler } from "nitro";
import { createEventStream } from "nitro/h3";
import { subscribeToThq } from "../utils/thqBus";

export default defineHandler((event) => {
  const stream = createEventStream(event);

  const unsubscribe = subscribeToThq((msg) => {
    void stream.push({ data: JSON.stringify(msg) });
  });

  stream.onClosed(() => unsubscribe());

  return stream.send();
});
