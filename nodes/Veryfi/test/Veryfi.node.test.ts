import type { IBinaryData, IExecuteFunctions, INode, INodeExecutionData } from 'n8n-workflow';

import * as GenericFunctions from '../GenericFunctions';
import { Veryfi } from '../Veryfi.node';

const TEST_FILE_BUFFER = Buffer.from('pretend-this-is-a-pdf');
const TEST_FILE_NAME = 'sample.pdf';
const EXPECTED_BASE64 = TEST_FILE_BUFFER.toString('base64');

const mockVeryfiResponse = {
	id: 1,
	invoice_number: '0998811',
	total: 329.74,
};

const mockClassifyResponse = {
	document_type: { score: 1, value: 'invoice' },
};

type ParamMap = Record<string, unknown>;

interface ExecMock {
	exec: IExecuteFunctions;
	getNodeParameter: jest.Mock;
	getInputData: jest.Mock;
	continueOnFail: jest.Mock;
	getNode: jest.Mock;
	assertBinaryData: jest.Mock;
	getBinaryDataBuffer: jest.Mock;
}

function createExecMock(): ExecMock {
	const getNodeParameter = jest.fn();
	const getInputData = jest.fn().mockReturnValue([{ json: {} }]);
	const continueOnFail = jest.fn().mockReturnValue(false);
	const getNode = jest.fn().mockReturnValue({ typeVersion: 1 } as INode);
	const assertBinaryData = jest.fn().mockReturnValue({
		fileName: TEST_FILE_NAME,
		mimeType: 'application/pdf',
		data: '',
	} satisfies Partial<IBinaryData> as IBinaryData);
	const getBinaryDataBuffer = jest.fn().mockResolvedValue(TEST_FILE_BUFFER);

	const exec = {
		getNodeParameter,
		getInputData,
		continueOnFail,
		getNode,
		helpers: {
			assertBinaryData,
			getBinaryDataBuffer,
		},
	} as unknown as IExecuteFunctions;

	return {
		exec,
		getNodeParameter,
		getInputData,
		continueOnFail,
		getNode,
		assertBinaryData,
		getBinaryDataBuffer,
	};
}

function setParams(mock: ExecMock, params: ParamMap) {
	const merged: ParamMap = { resource: 'document', ...params };
	mock.getNodeParameter.mockImplementation(
		(name: string, _i?: number, fallback?: unknown): unknown => {
			if (name in merged) return merged[name];
			return fallback;
		},
	);
}

type ResponseJson = Record<string, unknown>;

function firstItem(result: INodeExecutionData[][]): INodeExecutionData {
	return result[0][0];
}

describe('Veryfi Node', () => {
	const apiSpy = jest.spyOn(GenericFunctions, 'veryfiApiRequest');
	const node = new Veryfi();
	let mock: ExecMock;

	beforeEach(() => {
		jest.resetAllMocks();
		mock = createExecMock();
	});

	describe('extractInvoice operation', () => {
		it('posts file_data + file_name to /documents/ and returns the API response', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			const result = await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/documents/', {
				file_data: EXPECTED_BASE64,
				file_name: TEST_FILE_NAME,
			});
			expect(result).toEqual([[{ json: mockVeryfiResponse, pairedItem: { item: 0 } }]]);
		});

		it('forwards additional options into the request body', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: 'override.pdf',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {
					external_id: 'abc-123',
					tags: ['ops', 'expense'],
					boost_mode: true,
					categories: [],
					auto_categorize: false,
				},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/documents/', {
				file_data: EXPECTED_BASE64,
				file_name: 'override.pdf',
				external_id: 'abc-123',
				tags: ['ops', 'expense'],
				boost_mode: true,
				auto_categorize: false,
			});
		});

		it('flattens confidence-detail responses when requested', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: true,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue({
				invoice_number: { value: '0998811', score: 0.93, ocr_score: 0.98 },
			});

			const item = firstItem(await node.execute.call(mock.exec));
			const json = item.json as ResponseJson;

			expect(json.invoice_number).toBe('0998811');
			expect(json.invoice_number__score).toBe(0.93);
			expect(json.invoice_number__ocr_score).toBe(0.98);
		});

		it('preserves raw confidence shape when flattening is disabled', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: true,
				flattenConfidence: false,
				additionalOptions: {},
			});
			const raw = {
				invoice_number: { value: '0998811', score: 0.93, ocr_score: 0.98 },
			};
			apiSpy.mockResolvedValue(raw);

			const item = firstItem(await node.execute.call(mock.exec));

			expect(item.json).toEqual(raw);
		});
	});

	describe('extractReceipt operation', () => {
		it('uses the same /documents/ endpoint as invoice', async () => {
			setParams(mock, {
				operation: 'extractReceipt',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/documents/',
				expect.objectContaining({ file_data: EXPECTED_BASE64 }),
			);
		});
	});

	describe('extractCheck operation', () => {
		it('posts to /checks/', async () => {
			setParams(mock, {
				operation: 'extractCheck',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/checks/', expect.any(Object));
		});
	});

	describe('extractBankStatement operation', () => {
		it('posts to /bank-statements/', async () => {
			setParams(mock, {
				operation: 'extractBankStatement',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/bank-statements/',
				expect.any(Object),
			);
		});
	});

	describe('extractW9 operation', () => {
		it('posts to /w9s/', async () => {
			setParams(mock, {
				operation: 'extractW9',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/w9s/', expect.any(Object));
		});
	});

	describe('extractW2 operation', () => {
		it('posts to /w2s/', async () => {
			setParams(mock, {
				operation: 'extractW2',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/w2s/', expect.any(Object));
		});
	});

	describe('extractDriverLicense operation', () => {
		it('posts to /any-documents/ with blueprint_name=us_driver_license', async () => {
			setParams(mock, {
				operation: 'extractDriverLicense',
				binaryPropertyName: 'data',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/any-documents/',
				expect.objectContaining({
					file_data: EXPECTED_BASE64,
					blueprint_name: 'us_driver_license',
				}),
			);
		});
	});

	describe('extractPassport operation', () => {
		it('posts to /any-documents/ with blueprint_name=passport', async () => {
			setParams(mock, {
				operation: 'extractPassport',
				binaryPropertyName: 'data',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/any-documents/',
				expect.objectContaining({
					file_data: EXPECTED_BASE64,
					blueprint_name: 'passport',
				}),
			);
		});
	});

	describe('extractAnyDocument operation', () => {
		it('posts to /any-documents/ with the user-selected blueprint_name', async () => {
			setParams(mock, {
				operation: 'extractAnyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				blueprintName: 'utility_bill',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/any-documents/',
				expect.objectContaining({
					file_data: EXPECTED_BASE64,
					blueprint_name: 'utility_bill',
				}),
			);
		});

		it('throws when no blueprint name is provided', async () => {
			setParams(mock, {
				operation: 'extractAnyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				blueprintName: '',
				additionalOptions: {},
			});

			await expect(node.execute.call(mock.exec)).rejects.toThrow(/blueprint name is required/i);
		});
	});

	describe('classifyDocument operation', () => {
		it('posts to /classify/ without document_types when none supplied', async () => {
			setParams(mock, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: [],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			const result = await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/classify/', {
				file_data: EXPECTED_BASE64,
				file_name: TEST_FILE_NAME,
			});
			expect(result).toEqual([[{ json: mockClassifyResponse, pairedItem: { item: 0 } }]]);
		});

		it('forwards document_types when supplied', async () => {
			setParams(mock, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['invoice', 'receipt'],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.objectContaining({
					document_types: ['invoice', 'receipt'],
				}),
			);
		});

		it('strips empty / whitespace-only entries from document_types', async () => {
			setParams(mock, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['invoice', '', '  ', '\treceipt  '],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.objectContaining({
					document_types: ['invoice', 'receipt'],
				}),
			);
		});

		it('omits document_types entirely when all entries are blank', async () => {
			setParams(mock, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['', '   ', '\t\n'],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.not.objectContaining({ document_types: expect.anything() }),
			);
		});
	});

	describe('error handling', () => {
		it('continues on fail when continueOnFail is true', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			mock.continueOnFail.mockReturnValue(true);
			apiSpy.mockRejectedValue(new Error('boom'));

			const item = firstItem(await node.execute.call(mock.exec));

			expect(item.json).toEqual({ error: 'boom' });
			expect(item.pairedItem).toEqual({ item: 0 });
		});

		it('rethrows when continueOnFail is false', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockRejectedValue(new Error('boom'));

			await expect(node.execute.call(mock.exec)).rejects.toThrow('boom');
		});
	});

	describe('multiple input items', () => {
		it('runs once per item and tags pairedItem', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			mock.getInputData.mockReturnValue([{ json: {} }, { json: {} }]);
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			const [items] = await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledTimes(2);
			expect(items).toHaveLength(2);
			expect(items[0].pairedItem).toEqual({ item: 0 });
			expect(items[1].pairedItem).toEqual({ item: 1 });
		});
	});

	describe('url input mode', () => {
		it('sends file_url instead of file_data when fileSource is url', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: 'https://example.com/invoice.pdf',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(mock.getBinaryDataBuffer).not.toHaveBeenCalled();
			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/documents/', {
				file_url: 'https://example.com/invoice.pdf',
			});
		});

		it('passes the user-supplied file_name when present in url mode', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: 'https://example.com/invoice.pdf',
				fileName: 'override.pdf',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/documents/',
				expect.objectContaining({
					file_url: 'https://example.com/invoice.pdf',
					file_name: 'override.pdf',
				}),
			);
		});

		it('throws when fileSource is url but fileUrl is empty', async () => {
			setParams(mock, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: '',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});

			await expect(node.execute.call(mock.exec)).rejects.toThrow(/file URL is required/i);
		});

		it('still works for blueprint-based ops (driver license) in url mode', async () => {
			setParams(mock, {
				operation: 'extractDriverLicense',
				fileSource: 'url',
				fileUrl: 'https://example.com/dl.jpg',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(mock.exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/any-documents/', {
				file_url: 'https://example.com/dl.jpg',
				blueprint_name: 'us_driver_license',
			});
		});
	});

});
