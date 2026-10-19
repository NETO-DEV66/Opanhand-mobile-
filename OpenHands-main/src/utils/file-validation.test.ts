import { describe, expect, it } from "vitest";
import {
  validateFiles,
  validateIndividualFileSizes,
  validateTotalFileSize,
} from "./file-validation";

const MB = 1024 * 1024;

const makeFile = (name: string, sizeBytes: number): File =>
  new File([new Uint8Array(sizeBytes)], name);

describe("validateIndividualFileSizes", () => {
  it("accepts a file that used to be rejected under the old 3MB cap", () => {
    expect(
      validateIndividualFileSizes([makeFile("photo.png", 4 * MB)]),
    ).toEqual({ isValid: true });
  });

  it("accepts a file exactly at the 100MB limit", () => {
    expect(
      validateIndividualFileSizes([makeFile("big.zip", 100 * MB)]),
    ).toEqual({ isValid: true });
  });

  it("rejects a file one byte over the 100MB limit", () => {
    const result = validateIndividualFileSizes([
      makeFile("too-big.zip", 100 * MB + 1),
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain("100MB");
    expect(result.oversizedFiles).toEqual(["too-big.zip"]);
  });

  it("names every oversized file and leaves the others alone", () => {
    const result = validateIndividualFileSizes([
      makeFile("ok.bin", 10 * MB),
      makeFile("a.bin", 101 * MB),
      makeFile("b.bin", 200 * MB),
    ]);

    expect(result.isValid).toBe(false);
    expect(result.oversizedFiles).toEqual(["a.bin", "b.bin"]);
  });
});

describe("validateTotalFileSize", () => {
  it("counts already-attached files toward the total", () => {
    const result = validateTotalFileSize(
      [makeFile("new.bin", 60 * MB)],
      [makeFile("existing.bin", 60 * MB)],
    );

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain("100MB");
  });

  it("accepts a batch that fits inside 100MB in total", () => {
    const result = validateTotalFileSize([
      makeFile("one.bin", 40 * MB),
      makeFile("two.bin", 50 * MB),
    ]);

    expect(result.isValid).toBe(true);
  });
});

describe("validateFiles", () => {
  it("reports the individual size problem before the total", () => {
    const result = validateFiles([makeFile("huge.bin", 150 * MB)]);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain("exceeding 100MB");
  });

  it("allows a 100MB upload end to end", () => {
    expect(validateFiles([makeFile("archive.zip", 100 * MB)])).toEqual({
      isValid: true,
    });
  });
});
