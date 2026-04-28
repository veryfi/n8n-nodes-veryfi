import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { documentFields, documentOperations } from './DocumentDescription';
import {
	getFileAsBase64,
	loadBlueprints,
	transformConfidence,
	veryfiApiRequest,
} from './GenericFunctions';

interface RouteSpec {
	url: string;
	blueprintName?: string;
	supportsConfidence: boolean;
	supportsUrl: boolean;
}

const ROUTES: Record<string, RouteSpec> = {
	extractInvoice: {
		url: '/api/v8/partner/documents/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractReceipt: {
		url: '/api/v8/partner/documents/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractCheck: {
		url: '/api/v8/partner/checks/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractBankStatement: {
		url: '/api/v8/partner/bank-statements/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractW9: {
		url: '/api/v8/partner/w9s/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractW2: {
		url: '/api/v8/partner/w2s/',
		supportsConfidence: true,
		supportsUrl: true,
	},
	extractDriverLicense: {
		url: '/api/v8/partner/any-documents/',
		blueprintName: 'us_driver_license',
		supportsConfidence: false,
		supportsUrl: true,
	},
	extractPassport: {
		url: '/api/v8/partner/any-documents/',
		blueprintName: 'passport',
		supportsConfidence: false,
		supportsUrl: true,
	},
	extractAnyDocument: {
		url: '/api/v8/partner/any-documents/',
		supportsConfidence: false,
		supportsUrl: true,
	},
};

export class Veryfi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Veryfi',
		name: 'veryfi',
		icon: 'file:veryfi.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Extract data from invoices, receipts, checks, bank statements, W-9/W-2, IDs, and any document via Veryfi',
		defaults: {
			name: 'Veryfi',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'veryfiApi',
				required: true,
			},
		],
		properties: [...documentOperations, ...documentFields],
	};

	methods = {
		loadOptions: {
			getBlueprints: loadBlueprints,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		// Resource-level operations run once regardless of input items, then fan
		// out their results. We pair each emitted item back to item 0 of the input.
		if (resource === 'blueprint' && operation === 'listBlueprints') {
			try {
				const blueprints = await runListBlueprints.call(this);
				for (const blueprint of blueprints) {
					returnData.push({ json: blueprint, pairedItem: { item: 0 } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: 0 },
					});
				} else {
					throw error;
				}
			}
			return [returnData];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				let response: IDataObject;

				if (resource === 'document' && operation === 'classifyDocument') {
					response = await runClassify.call(this, i);
				} else if (resource === 'document') {
					const route = ROUTES[operation];
					if (!route) {
						throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
							itemIndex: i,
						});
					}
					response = await runExtract.call(this, i, operation, route);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
						itemIndex: i,
					});
				}

				returnData.push({ json: response, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function runExtract(
	this: IExecuteFunctions,
	itemIndex: number,
	operation: string,
	route: RouteSpec,
): Promise<IDataObject> {
	const fileSource = this.getNodeParameter('fileSource', itemIndex, 'binary') as string;
	const userFileName = this.getNodeParameter('fileName', itemIndex, '') as string;
	const additionalOptions = this.getNodeParameter(
		'additionalOptions',
		itemIndex,
		{},
	) as IDataObject;

	const body: IDataObject = {};

	if (fileSource === 'url') {
		if (!route.supportsUrl) {
			throw new NodeOperationError(
				this.getNode(),
				`Operation "${operation}" does not support URL input`,
				{ itemIndex },
			);
		}
		const fileUrl = this.getNodeParameter('fileUrl', itemIndex) as string;
		if (!fileUrl) {
			throw new NodeOperationError(this.getNode(), 'A file URL is required', { itemIndex });
		}
		body.file_url = fileUrl;
		if (userFileName) {
			body.file_name = userFileName;
		}
	} else {
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
		const { fileData, fileName: detectedFileName } = await getFileAsBase64.call(
			this,
			itemIndex,
			binaryPropertyName,
		);
		body.file_data = fileData;
		const fileName = userFileName || detectedFileName;
		if (fileName) {
			body.file_name = fileName;
		}
	}

	if (route.blueprintName) {
		body.blueprint_name = route.blueprintName;
	}

	if (operation === 'extractAnyDocument') {
		const blueprintName = this.getNodeParameter('blueprintName', itemIndex) as string;
		if (!blueprintName) {
			throw new NodeOperationError(
				this.getNode(),
				'A blueprint name is required for "Extract Data From Any Document"',
				{ itemIndex },
			);
		}
		body.blueprint_name = blueprintName;
	}

	let confidenceRequested = false;
	if (route.supportsConfidence) {
		confidenceRequested = this.getNodeParameter('confidenceDetails', itemIndex, false) as boolean;
		if (confidenceRequested) {
			body.confidence_details = true;
		}
	}

	for (const key of Object.keys(additionalOptions)) {
		const value = additionalOptions[key];
		if (value === undefined || value === null) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		if (typeof value === 'string' && value.length === 0) continue;
		body[key] = value as IDataObject[keyof IDataObject];
	}

	let response = (await veryfiApiRequest.call(this, 'POST', route.url, body)) as IDataObject;

	if (confidenceRequested) {
		const flatten = this.getNodeParameter('flattenConfidence', itemIndex, true) as boolean;
		if (flatten) {
			response = transformConfidence(response) as IDataObject;
		}
	}

	return response;
}

async function runClassify(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const userFileName = this.getNodeParameter('fileName', itemIndex, '') as string;
	const rawDocumentTypes = this.getNodeParameter('documentTypes', itemIndex, []) as string[];
	const documentTypes = (rawDocumentTypes ?? [])
		.filter((t): t is string => typeof t === 'string')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	const { fileData, fileName: detectedFileName } = await getFileAsBase64.call(
		this,
		itemIndex,
		binaryPropertyName,
	);

	const body: IDataObject = { file_data: fileData };

	const fileName = userFileName || detectedFileName;
	if (fileName) {
		body.file_name = fileName;
	}

	if (documentTypes.length > 0) {
		body.document_types = documentTypes;
	}

	return (await veryfiApiRequest.call(
		this,
		'POST',
		'/api/v8/partner/classify/',
		body,
	)) as IDataObject;
}

async function runListBlueprints(this: IExecuteFunctions): Promise<IDataObject[]> {
	const response = (await veryfiApiRequest.call(this, 'GET', '/api/v8/partner/blueprints/')) as {
		blueprints?: IDataObject[];
	};

	return response?.blueprints ?? [];
}
