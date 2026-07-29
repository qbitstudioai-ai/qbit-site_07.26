import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HowWeWorkPage } from "@/features/how-we-work/HowWeWorkPage";

describe("HowWeWorkPage analysis terminal sequence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("waits for the QBit boot mark to finish before typing, then uses the 10% faster interval", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { container } = render(<HowWeWorkPage />);

    fireEvent.wheel(window, { deltaY: 100 });
    expect(container.querySelector("[data-active-scene='1']")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const output = container.querySelector("[class*='terminal-output']");
    expect(output).toHaveTextContent("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3743);
    });
    expect(output).toHaveTextContent("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(output).toHaveTextContent("Г");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(149);
    });
    expect(output).toHaveTextContent("Г");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(output).toHaveTextContent("Го");
  });
});
