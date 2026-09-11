# Production deployment

## Required services

- Node.js 22 or the included Dockerfile.
- Convex Cloud production deployment, or a self-hosted Convex backend.
- HTTPS reverse proxy or Cloudflare.

File uploads are stored in Convex storage.

## Release order

1. Configure `NEXT_PUBLIC_CONVEX_URL` and `APP_URL`.
2. Run `npm ci`, `npx convex deploy`, `npm run build`.
3. On the first production database only, set bootstrap credentials and run `npm run db:bootstrap`. Remove those two environment variables immediately afterward.
4. Start the application and verify `/api/health`, `/robots.txt`, `/sitemap.xml`, login, upload/download, enrollment, assignment, submission, and grading.
5. Put Cloudflare rate limiting in front of `/dang-nhap`, `/dang-ky-tu-van`, and Server Action POST requests.

## Optional AI question extraction

Set `QUESTION_AI_ENDPOINT` and optionally `QUESTION_AI_TOKEN`. The endpoint receives extracted document text and must return the documented question JSON shape. Without it, TXT, DOCX, and text-based PDF files use deterministic parsing; scanned PDFs require an OCR/AI provider.

## Backup rule

Back up the Convex deployment (or self-hosted Convex data directory) before onboarding real students. Test restoration on staging.
