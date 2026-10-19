import type { Config } from "@react-router/dev/config";

/**
 * This script is used to unpack the client directory from the frontend build directory.
 * Remix SPA mode builds the client directory into the build directory. This function
 * moves the contents of the client directory to the build directory and then removes the
 * client directory.
 *
 * This script is used in the buildEnd function of the Vite config.
 */
let unpackClientDirectoryPromise: Promise<void> | null = null;

const moveBuildEntry = async (
  fs: typeof import("fs"),
  source: string,
  destination: string,
) => {
  await fs.promises.rm(destination, { recursive: true, force: true });

  try {
    await fs.promises.rename(source, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EXDEV") {
      throw error;
    }

    await fs.promises.cp(source, destination, {
      recursive: true,
      force: true,
    });
    await fs.promises.rm(source, { recursive: true, force: true });
  }
};

const unpackClientDirectoryOnce = async () => {
  const fs = await import("fs");
  const path = await import("path");

  const buildDir = path.resolve(__dirname, "build");
  const clientDir = path.resolve(buildDir, "client");

  let files: string[];
  try {
    files = await fs.promises.readdir(clientDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const file of files) {
    await moveBuildEntry(
      fs,
      path.resolve(clientDir, file),
      path.resolve(buildDir, file),
    );
  }

  await fs.promises.rm(clientDir, { recursive: true, force: true });
};

const unpackClientDirectory = async () => {
  unpackClientDirectoryPromise ??= unpackClientDirectoryOnce().finally(() => {
    unpackClientDirectoryPromise = null;
  });

  await unpackClientDirectoryPromise;
};

export default {
  appDirectory: "src",
  buildEnd: unpackClientDirectory,
  ssr: false,
} satisfies Config;
