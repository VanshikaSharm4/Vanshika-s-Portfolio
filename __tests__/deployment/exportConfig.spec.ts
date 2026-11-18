import { execFileSync } from "child_process";

describe("static export configuration", () => {
  it("keeps Next's production build directory so the export is written to out", () => {
    const config = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "-e",
          "const config = require('./next.config.js'); process.stdout.write(JSON.stringify({ distDir: config.distDir, output: config.output }));",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, NODE_ENV: "production" },
        }
      )
    ) as { distDir: string; output: string };

    expect(config).toStrictEqual({ distDir: ".next", output: "export" });
  });
});
