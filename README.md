# n8n-nodes-veryfi

This is an [n8n](https://n8n.io) community node for [Veryfi](https://www.veryfi.com), a document-AI platform that turns invoices, receipts, checks, bank statements, tax forms, and identity documents into structured, machine-readable data via OCR and machine learning.

[n8n](https://n8n.io) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Sample workflow](#sample-workflow)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### From the n8n Cloud or self-hosted editor

1. Go to **Settings** > **Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-veryfi` and select **Install**.

### Manual installation (self-hosted)

```bash
cd ~/.n8n/custom
npm install n8n-nodes-veryfi
```

Then restart n8n.

## Operations

The node exposes one resource:

### Resource: Document

| Operation | Endpoint | Notes |
| --- | --- | --- |
| **Extract Data From Invoice** | `POST /api/v8/partner/documents/` | Returns vendor, totals, line items, dates, etc. |
| **Extract Data From Receipt** | `POST /api/v8/partner/documents/` | Same endpoint as invoice; the model auto-detects. |
| **Extract Data From Check** | `POST /api/v8/partner/checks/` | Payer, payee, MICR, amounts, endorsement info. |
| **Extract Data From Bank Statement** | `POST /api/v8/partner/bank-statements/` | Account holder, balances, statement period, transactions. |
| **Extract Data From W-9** | `POST /api/v8/partner/w9s/` | TIN/EIN/SSN, business classification, signature. |
| **Extract Data From W-2** | `POST /api/v8/partner/w2s/` | Wage and tax information including state tax lines and Box 12 codes. |
| **Extract Data From Driver License** | `POST /api/v8/partner/any-documents/` (`blueprint_name=us_driver_license`) | US driver license image. |
| **Extract Data From Passport** | `POST /api/v8/partner/any-documents/` (`blueprint_name=passport`) | Passport image. |
| **Extract Data From Any Document** | `POST /api/v8/partner/any-documents/` | Pick any blueprint available to your account from a dynamic dropdown. |
| **Classify Document** | `POST /api/v8/partner/classify/` | Returns one of `receipt`, `invoice`, `purchase_order`, `w9`, `statement`, `check`, `packing_slip`, `contract`, `w8`, `remittance_advice`, `bank_statement`, `credit_note`, `w2`, `other` (or a custom list). |

### Input modes

Every extraction operation accepts a document as either:

- **Binary File** — wired in from any upstream node (Read/Write Files, Gmail, HTTP Request, Google Drive, Dropbox, Webhook…). The node reads the binary buffer and base64-encodes it before calling Veryfi.
- **URL** — a public HTTP(S) URL. Veryfi fetches the document directly server-side.

`Classify Document` is binary-only because the Veryfi `/classify/` endpoint does not accept `file_url`.

### Confidence details

Six extraction operations (Invoice, Receipt, Check, Bank Statement, W-9, W-2) expose a **Confidence Details** toggle. When enabled, Veryfi returns each extracted field as `{ value, score, ocr_score }`.

An additional **Flatten Confidence Scores** toggle (default on) reshapes the response so each field is emitted as three sibling keys for easier downstream mapping. For example:

```json
{
	"invoice_number": { "value": "INV-001", "score": 0.93, "ocr_score": 0.98 }
}
```

becomes

```json
{
	"invoice_number": "INV-001",
	"invoice_number__score": 0.93,
	"invoice_number__ocr_score": 0.98
}
```

Nested objects (e.g. `vendor`, `bill_to`, `ship_to`) are flattened one level using `__` as a separator (`vendor__name__score`). Confidence objects inside arrays (e.g. `line_items`) have their `value` hoisted in place.

### Additional options

Each extraction operation has an **Additional Options** collection where you can opt into:

- `auto_categorize` — let Veryfi auto-categorize the document.
- `boost_mode` — return extracted data without document image storage.
- `categories` — constrain the auto-categorizer to a custom list.
- `external_id` — attach an external identifier to the document.
- `tags` — attach tags to the document.

Veryfi silently ignores fields that aren't supported on a given endpoint.

## Credentials

You need a Veryfi account and an API key.

1. Sign in to [Veryfi](https://app.veryfi.com).
2. Go to **Settings → Keys** ([app.veryfi.com/api/settings/keys](https://app.veryfi.com/api/settings/keys/)).
3. Copy your **CLIENT ID**, **USERNAME**, and **API KEY**.
4. In n8n, add the Veryfi node to a workflow and select **Create New Credential**.
5. Paste the three values. n8n will validate the credentials by hitting `https://api.veryfi.com/api/v8/partner/documents/schema/`.

The API key is encrypted at rest by n8n and masked in execution logs. The username cannot contain spaces or colons (it forms part of the `Authorization` header).

For endpoints not covered by a dedicated operation, use n8n's built-in **HTTP Request** node and select **Veryfi API** as the predefined credential type — your CLIENT-ID + auth headers will be injected automatically.

## Sample workflow

Drop this JSON into the n8n editor (`File → Import from clipboard`) to get a working "process invoice" workflow that you can adapt:

```json
{
	"name": "Veryfi - Extract Invoice",
	"nodes": [
		{
			"parameters": {},
			"id": "manual-trigger",
			"name": "When clicking 'Test workflow'",
			"type": "n8n-nodes-base.manualTrigger",
			"typeVersion": 1,
			"position": [200, 300]
		},
		{
			"parameters": {
				"url": "https://cdn.veryfi.com/showcase/invoice-sample.pdf",
				"options": {
					"response": {
						"response": {
							"responseFormat": "file",
							"outputPropertyName": "data"
						}
					}
				}
			},
			"id": "http-request",
			"name": "Download Invoice",
			"type": "n8n-nodes-base.httpRequest",
			"typeVersion": 4,
			"position": [440, 300]
		},
		{
			"parameters": {
				"resource": "document",
				"operation": "extractInvoice",
				"fileSource": "binary",
				"binaryPropertyName": "data",
				"confidenceDetails": false
			},
			"id": "veryfi",
			"name": "Veryfi",
			"type": "n8n-nodes-veryfi.veryfi",
			"typeVersion": 1,
			"position": [680, 300],
			"credentials": {
				"veryfiApi": {
					"name": "Veryfi account"
				}
			}
		}
	],
	"connections": {
		"When clicking 'Test workflow'": {
			"main": [[{ "node": "Download Invoice", "type": "main", "index": 0 }]]
		},
		"Download Invoice": {
			"main": [[{ "node": "Veryfi", "type": "main", "index": 0 }]]
		}
	}
}
```

## Compatibility

| Component | Required version |
| --- | --- |
| n8n | 1.0.0 or newer |
| Node.js | 20.15 or newer |
| Veryfi API | v8 (partner endpoints) |

The node uses programmatic style with `usableAsTool: true`, so it can be wired up as a tool to n8n's AI Agent node.

## Resources

- [n8n community-nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Veryfi product website](https://www.veryfi.com)
- [Veryfi API documentation](https://docs.veryfi.com/)
- [Veryfi Keys page](https://app.veryfi.com/api/settings/keys/)
- [Report an issue](https://github.com/veryfi/n8n-nodes-veryfi/issues)

## License

[MIT](LICENSE)
