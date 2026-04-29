import type { INodeProperties } from 'n8n-workflow';

export const EXTRACT_OPERATIONS = [
	'extractInvoice',
	'extractReceipt',
	'extractCheck',
	'extractBankStatement',
	'extractW9',
	'extractW2',
	'extractDriverLicense',
	'extractPassport',
	'extractAnyDocument',
];

export const FILE_OPERATIONS = [...EXTRACT_OPERATIONS, 'classifyDocument'];

export const CONFIDENCE_OPERATIONS = [
	'extractInvoice',
	'extractReceipt',
	'extractCheck',
	'extractBankStatement',
	'extractW9',
	'extractW2',
];

export const SENSITIVE_OPERATIONS = [
	'extractCheck',
	'extractBankStatement',
	'extractW9',
	'extractW2',
	'extractDriverLicense',
	'extractPassport',
];

export const documentOperations: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Blueprint',
				value: 'blueprint',
			},
			{
				name: 'Document',
				value: 'document',
			},
		],
		default: 'document',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['document'],
			},
		},
		options: [
			{
				name: 'Classify Document',
				value: 'classifyDocument',
				action: 'Classify a document',
				description: "Classify a document into one of Veryfi's document types",
			},
			{
				name: 'Extract Data From Any Document',
				value: 'extractAnyDocument',
				action: 'Extract data from any document via blueprint',
				description: 'Extract structured data using any Veryfi blueprint available to your account',
			},
			{
				name: 'Extract Data From Bank Statement',
				value: 'extractBankStatement',
				action: 'Extract data from a bank statement',
				description: 'Extract account holder, balances, statement period, and transactions',
			},
			{
				name: 'Extract Data From Check',
				value: 'extractCheck',
				action: 'Extract data from a check',
				description:
					'Extract payer, payee, MICR, amounts, and endorsement info from a US bank check',
			},
			{
				name: 'Extract Data From Driver License',
				value: 'extractDriverLicense',
				action: 'Extract data from a driver license',
				description: 'Extract personal data from a US driver license image',
			},
			{
				name: 'Extract Data From Invoice',
				value: 'extractInvoice',
				action: 'Extract data from an invoice',
				description: 'Extract structured data from an invoice',
			},
			{
				name: 'Extract Data From Passport',
				value: 'extractPassport',
				action: 'Extract data from a passport',
				description: 'Extract personal data from a passport image',
			},
			{
				name: 'Extract Data From Receipt',
				value: 'extractReceipt',
				action: 'Extract data from a receipt',
				description: 'Extract structured data from a receipt',
			},
			{
				name: 'Extract Data From W-2',
				value: 'extractW2',
				action: 'Extract data from a W-2 form',
				description: 'Extract wage and tax information from an IRS Form W-2',
			},
			{
				name: 'Extract Data From W-9',
				value: 'extractW9',
				action: 'Extract data from a W-9 form',
				description: 'Extract taxpayer information from an IRS Form W-9',
			},
		],
		default: 'extractInvoice',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['blueprint'],
			},
		},
		options: [
			{
				name: 'List',
				value: 'listBlueprints',
				action: 'List blueprints',
				description: 'Return all blueprints available to your Veryfi account',
			},
		],
		default: 'listBlueprints',
	},
];

export const documentFields: INodeProperties[] = [
	{
		displayName:
			'Reminder: documents may contain Sensitive Personal Data. Only route them through workflows you are authorized to operate, and only to downstream apps approved for that data.',
		name: 'sensitiveDataNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: SENSITIVE_OPERATIONS,
			},
		},
	},
	{
		displayName: 'File Source',
		name: 'fileSource',
		type: 'options',
		default: 'binary',
		description: 'Where the document comes from',
		options: [
			{
				name: 'Binary File',
				value: 'binary',
				description: 'Use binary data from a previous node (Read/Write Files, HTTP, Drive, etc.)',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Provide a public URL; Veryfi will fetch the document directly',
			},
		],
		displayOptions: {
			show: {
				resource: ['document'],
				operation: EXTRACT_OPERATIONS,
			},
		},
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field that contains the file to upload (PDF, JPEG, PNG, or TIFF)',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: EXTRACT_OPERATIONS,
				fileSource: ['binary'],
			},
		},
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field that contains the file to upload (PDF, JPEG, PNG, or TIFF)',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['classifyDocument'],
			},
		},
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/invoice.pdf',
		description:
			'Public URL of the document. Veryfi will fetch and process it server-side. Must be reachable without authentication.',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: EXTRACT_OPERATIONS,
				fileSource: ['url'],
			},
		},
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		placeholder: 'e.g. invoice.pdf',
		description:
			'Optional file name to send to Veryfi. If left empty, the file name is taken from the binary input (or omitted for URL input).',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: FILE_OPERATIONS,
			},
		},
	},
	{
		displayName: 'Blueprint Name or ID',
		name: 'blueprintName',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getBlueprints',
		},
		required: true,
		default: '',
		description:
			'Choose which Veryfi blueprint to use. The list is loaded from your Veryfi account. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['extractAnyDocument'],
			},
		},
	},
	{
		displayName: 'Document Types',
		name: 'documentTypes',
		type: 'string',
		typeOptions: {
			multipleValues: true,
		},
		default: [],
		placeholder: 'Add document type',
		description:
			'Optional custom list of document types to classify against. If empty, Veryfi uses its defaults: receipt, invoice, purchase_order, w9, statement, check, packing_slip, contract, w8, remittance_advice, bank_statement, credit_note, w2, other.',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['classifyDocument'],
			},
		},
	},
	{
		displayName: 'Confidence Details',
		name: 'confidenceDetails',
		type: 'boolean',
		default: false,
		description:
			'Whether to include per-field confidence scores in the response. Veryfi will return each field as <code>{ value, score, ocr_score }</code>.',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: CONFIDENCE_OPERATIONS,
			},
		},
	},
	{
		displayName: 'Flatten Confidence Scores',
		name: 'flattenConfidence',
		type: 'boolean',
		default: true,
		description:
			'Whether to flatten <code>{ value, score, ocr_score }</code> objects into <code>field</code>, <code>field__score</code>, and <code>field__ocr_score</code> sibling keys for easier downstream mapping',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: CONFIDENCE_OPERATIONS,
				confidenceDetails: [true],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: ['document'],
				operation: EXTRACT_OPERATIONS,
			},
		},
		options: [
			{
				displayName: 'Auto Categorize',
				name: 'auto_categorize',
				type: 'boolean',
				default: true,
				description: 'Whether to let Veryfi auto-categorize the document',
			},
			{
				displayName: 'Boost Mode',
				name: 'boost_mode',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable boost mode (returns extracted data without document image storage)',
			},
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'Add category',
				description: 'Optional list of categories to constrain the auto-categorizer',
			},
			{
				displayName: 'External ID',
				name: 'external_id',
				type: 'string',
				default: '',
				description: 'Optional external identifier to associate with this document',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'Add tag',
				description: 'Optional tags to attach to the document',
			},
		],
	},
];
