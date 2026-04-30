import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useFavourites } from "./useFavourites";

describe("useFavourites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty by default", () => {
    const { result } = renderHook(() => useFavourites());
    expect(result.current.favourites.size).toBe(0);
    expect(result.current.has("anything")).toBe(false);
  });

  it("toggle adds and removes ids", () => {
    const { result } = renderHook(() => useFavourites());
    act(() => result.current.toggle("raval"));
    expect(result.current.has("raval")).toBe(true);
    act(() => result.current.toggle("raval"));
    expect(result.current.has("raval")).toBe(false);
  });

  it("persists across hook remounts (page refresh proxy)", () => {
    const first = renderHook(() => useFavourites());
    act(() => first.result.current.toggle("raval"));
    act(() => first.result.current.toggle("palma"));
    first.unmount();

    const second = renderHook(() => useFavourites());
    expect(second.result.current.has("raval")).toBe(true);
    expect(second.result.current.has("palma")).toBe(true);
  });

  it("clear removes all entries", () => {
    const { result } = renderHook(() => useFavourites());
    act(() => result.current.toggle("raval"));
    act(() => result.current.toggle("palma"));
    expect(result.current.favourites.size).toBe(2);
    act(() => result.current.clear());
    expect(result.current.favourites.size).toBe(0);
    expect(window.localStorage.getItem("sc-favs")).toBe("[]");
  });

  it("ignores garbage in localStorage", () => {
    window.localStorage.setItem("sc-favs", "{not json");
    const { result } = renderHook(() => useFavourites());
    expect(result.current.favourites.size).toBe(0);
  });
});
