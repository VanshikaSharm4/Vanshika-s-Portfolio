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

## Local checks

For a normal root-hosted export, run yarn install --frozen-lockfile, then yarn build and yarn serve.

To test a GitHub project-path export in PowerShell, set $env:NEXT_PUBLIC_BASE_PATH to "/Vanshika-s-Portfolio", then run yarn build. Remove the environment variable afterward with Remove-Item Env:NEXT_PUBLIC_BASE_PATH.

The preview host must mount out/ at that same prefix. Development continues to use the root path unless the environment variable is explicitly set.

## Asset paths

Next.js builds its bundles with basePath. The export preparation step rebases static HTML and CSS asset URLs, adds .nojekyll, and inserts a small compatibility script before app scripts on subpath-hosted pages. This script resolves root-relative browser resource requests beneath the mount, including BrowserFS and embedded app requests. Virtual desktop paths such as /Users/Public stay unchanged inside the file system.

Root-hosted exports do not load the compatibility script.

GitHub Pages cannot set custom cross-origin headers. Portfolio pages, the desktop, and normal file navigation work there. Browser emulators and other advanced apps requiring cross-origin isolation may need Vercel or another host with header support.
