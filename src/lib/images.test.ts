import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeImage, validateImageFile } from "./images";

const TEN_MIB = 10 * 1024 * 1024;

describe("validateImageFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepte le format %s", (type) => {
    const file = new File(["image"], "photo", { type });

    expect(() => validateImageFile(file)).not.toThrow();
  });

  it("refuse les formats qui ne sont pas des images matricielles autorisées", () => {
    const file = new File(["<svg />"], "decor.svg", { type: "image/svg+xml" });

    expect(() => validateImageFile(file)).toThrow("image_type_not_allowed");
  });

  it("refuse un fichier de plus de 10 Mio", () => {
    const file = new File([new Uint8Array(TEN_MIB + 1)], "fond.png", { type: "image/png" });

    expect(() => validateImageFile(file)).toThrow("image_too_large");
  });
});

describe("resizeImage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("conserve le ratio, limite les dimensions et produit un WebP", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }));
    const drawImage = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob(["optimized"], { type }));
    });

    const result = await resizeImage(new File(["image"], "fond.png", { type: "image/png" }), 1920, 1080, 0.84);

    expect(result.type).toBe("image/webp");
    expect(getContext.mock.instances[0]).toMatchObject({ width: 1920, height: 960 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 960);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.84);
    expect(close).toHaveBeenCalledOnce();
  });
});
