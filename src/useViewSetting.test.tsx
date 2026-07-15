// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useViewSetting, ViewSettingsProvider } from "./useViewSetting";

function Counter() {
  const [count, setCount] = useViewSetting("test.count", 0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      count: {count}
    </button>
  );
}

function Harness({ show }: { show: boolean }) {
  return <ViewSettingsProvider>{show && <Counter />}</ViewSettingsProvider>;
}

afterEach(cleanup);

describe("useViewSetting", () => {
  it("Provider 配下ではアンマウント後の再マウントで値を復元する", () => {
    const { rerender, getByRole } = render(<Harness show />);
    fireEvent.click(getByRole("button"));
    fireEvent.click(getByRole("button"));
    expect(getByRole("button").textContent).toBe("count: 2");

    rerender(<Harness show={false} />);
    rerender(<Harness show />);

    expect(getByRole("button").textContent).toBe("count: 2");
  });

  it("Provider ごとにストアが独立している", () => {
    const first = render(<Harness show />);
    fireEvent.click(first.getByRole("button"));
    expect(first.getByRole("button").textContent).toBe("count: 1");
    first.unmount();

    const second = render(<Harness show />);
    expect(second.getByRole("button").textContent).toBe("count: 0");
  });

  it("Provider が無い場合は通常の useState と同じ振る舞いになる", () => {
    const { rerender, getByRole } = render(<Counter />);
    fireEvent.click(getByRole("button"));
    expect(getByRole("button").textContent).toBe("count: 1");

    rerender(<div />);
    rerender(<Counter />);

    expect(getByRole("button").textContent).toBe("count: 0");
  });
});
