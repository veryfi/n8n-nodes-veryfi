# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - TBD

### Added

- Initial public release.
- `Veryfi` node with two resources (Document, Blueprint) and 11 operations:
  - Document → Extract Data From Invoice / Receipt / Check / Bank Statement / W-9 / W-2 / Driver License / Passport / Any Document, plus Classify Document.
  - Blueprint → List.
- `VeryfiApi` credential (CLIENT-ID + USERNAME + API KEY header authentication) with a connection test against `GET /api/v8/partner/documents/schema/`.
- File source switch on extraction operations: Binary File (base64-encoded client-side) or URL (forwarded as `file_url` to Veryfi).
- Confidence Details toggle on the six operations Veryfi supports it for, with an optional Flatten Confidence Scores helper that reshapes `{ value, score, ocr_score }` into `field`, `field__score`, `field__ocr_score` sibling keys.
- Dynamic blueprint dropdown for the "Extract Data From Any Document" operation, populated from `GET /api/v8/partner/blueprints/`.
- Sensitive-data reminder notice on operations that handle personal data (Check, Bank Statement, W-9, W-2, Driver License, Passport).
- Additional Options collection for `auto_categorize`, `boost_mode`, `categories`, `external_id`, and `tags`.
- Sample workflow JSON in the README.

[Unreleased]: https://github.com/veryfi/n8n-nodes-veryfi/compare/0.1.0...HEAD
[0.1.0]: https://github.com/veryfi/n8n-nodes-veryfi/releases/tag/0.1.0
