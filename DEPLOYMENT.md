# Deploy the portfolio

Both hosts publish the static out/ export from yarn build. Use Node.js 22 and Yarn 1. Do not publish the repository root as the website.

## GitHub Pages

1. Open **Settings → Pages** in the GitHub repository.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Run **Actions → Deploy portfolio to GitHub Pages → Run workflow**, or push to main.

The workflow uses GitHub's Pages metadata to choose the correct base path. The normal project URL is:

https://vanshikasharm4.github.io/Vanshika-s-Portfolio/

Custom domains and user sites also work because the workflow uses the actual host base path instead of hard-coding the repository name.

## Vercel

1. Import VanshikaSharm4/Vanshika-s-Portfolio.
2. Keep the repository root as **Root Directory**.
3. Use the committed vercel.json: framework **Other**, install command **yarn install --frozen-lockfile**, build command **yarn build**, output directory **out**.
4. Deploy. No service credentials are required for the portfolio.

Vercel builds with an empty base path and supplies the cross-origin headers used by some browser apps.

## Shared flower vase

The portfolio reads and posts flowers through a Cloudflare Worker backed by D1. Both hosts can use the same Worker URL and bouquet.

1. Open a terminal in the `flower-vase` directory and sign in with `npx wrangler@4 login`.
2. For a new Cloudflare account, run `npx wrangler@4 d1 create vanshika-flower-vase` and put the resulting database ID in `wrangler.jsonc`. The checked-in ID refers to the portfolio's existing database.
3. Run `npx wrangler@4 d1 migrations apply vanshika-flower-vase --remote`, then `npx wrangler@4 deploy`.
4. Set `NEXT_PUBLIC_FLOWER_VASE_API` to the deployed Worker URL followed by `/flowers`. On GitHub, add it under **Settings → Secrets and variables → Actions → Variables** and rerun the Pages workflow. On Vercel, add it under **Settings → Environment Variables** and redeploy.

GitHub Pages' origin is already allowed. To connect Vercel or a custom domain, append its origin to `ALLOWED_ORIGINS` as a comma-separated value, then redeploy the Worker. Use origins such as `https://example.vercel.app` without a path or trailing slash.

Flowers and notes are public. The Worker accepts PNG drawings from the editor and notes of up to 200 characters. It limits repeat submissions. To remove a flower, find its ID in the Worker’s `/flowers` response or the D1 console, then delete that row from the `flowers` table.

For local development, apply the migration with `--local` instead of `--remote`. Run `npx wrangler@4 dev --ip 127.0.0.1 --port 8787 --var ALLOWED_ORIGINS:http://127.0.0.1:3000` and start the Next.js development server with `NEXT_PUBLIC_FLOWER_VASE_API=http://127.0.0.1:8787/flowers`. Open the portfolio at `http://127.0.0.1:3000/`.

## Local checks

For a normal root-hosted export, run yarn install --frozen-lockfile, then yarn build and yarn serve.

To test a GitHub project-path export in PowerShell, set $env:NEXT_PUBLIC_BASE_PATH to "/Vanshika-s-Portfolio", then run yarn build. Remove the environment variable afterward with Remove-Item Env:NEXT_PUBLIC_BASE_PATH.

The preview host must mount out/ at that same prefix. Development continues to use the root path unless the environment variable is explicitly set.

## Asset paths

Next.js builds its bundles with basePath. The export preparation step rebases static HTML and CSS asset URLs, adds .nojekyll, and inserts a small compatibility script before app scripts on subpath-hosted pages. This script resolves root-relative browser resource requests beneath the mount, including BrowserFS and embedded app requests. Virtual desktop paths such as /Users/Public stay unchanged inside the file system.

Root-hosted exports do not load the compatibility script.

GitHub Pages cannot set custom cross-origin headers. Portfolio pages, the desktop, and normal file navigation work there. Browser emulators and other advanced apps requiring cross-origin isolation may need Vercel or another host with header support.
