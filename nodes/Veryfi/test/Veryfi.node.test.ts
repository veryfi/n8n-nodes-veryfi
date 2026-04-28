import { mockDeep } from 'jest-mock-extended';
import type { IExecuteFunctions, INode } from 'n8n-workflow';

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

function setParams(execMock: ReturnType<typeof mockDeep<IExecuteFunctions>>, params: ParamMap) {
	const merged: ParamMap = { resource: 'document', ...params };
	execMock.getNodeParameter.mockImplementation(((name: string, _i?: number, fallback?: unknown) => {
		if (name in merged) return merged[name];
		return fallback;
	}) as IExecuteFunctions['getNodeParameter']);
}

describe('Veryfi Node', () => {
	const exec = mockDeep<IExecuteFunctions>();
	const apiSpy = jest.spyOn(GenericFunctions, 'veryfiApiRequest');
	const node = new Veryfi();

	beforeEach(() => {
		jest.resetAllMocks();
		exec.getNode.mockReturnValue({ typeVersion: 1 } as INode);
		exec.getInputData.mockReturnValue([{ json: {} }]);
		exec.continueOnFail.mockReturnValue(false);
		exec.helpers.assertBinaryData.mockReturnValue({
			fileName: TEST_FILE_NAME,
			mimeType: 'application/pdf',
			data: '',
		} as any);
		exec.helpers.getBinaryDataBuffer.mockResolvedValue(TEST_FILE_BUFFER);
	});

	describe('extractInvoice operation', () => {
		it('posts file_data + file_name to /documents/ and returns the API response', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			const result = await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/documents/', {
				file_data: EXPECTED_BASE64,
				file_name: TEST_FILE_NAME,
			});
			expect(result).toEqual([[{ json: mockVeryfiResponse, pairedItem: { item: 0 } }]]);
		});

		it('forwards additional options into the request body', async () => {
			setParams(exec, {
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

			await node.execute.call(exec);

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
			setParams(exec, {
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

			const [[item]] = await node.execute.call(exec);

			expect((item.json as any).invoice_number).toBe('0998811');
			expect((item.json as any).invoice_number__score).toBe(0.93);
			expect((item.json as any).invoice_number__ocr_score).toBe(0.98);
		});

		it('preserves raw confidence shape when flattening is disabled', async () => {
			setParams(exec, {
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

			const [[item]] = await node.execute.call(exec);

			expect(item.json).toEqual(raw);
		});
	});

	describe('extractReceipt operation', () => {
		it('uses the same /documents/ endpoint as invoice', async () => {
			setParams(exec, {
				operation: 'extractReceipt',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/documents/',
				expect.objectContaining({ file_data: EXPECTED_BASE64 }),
			);
		});
	});

	describe('extractCheck operation', () => {
		it('posts to /checks/', async () => {
			setParams(exec, {
				operation: 'extractCheck',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/checks/', expect.any(Object));
		});
	});

	describe('extractBankStatement operation', () => {
		it('posts to /bank-statements/', async () => {
			setParams(exec, {
				operation: 'extractBankStatement',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/bank-statements/',
				expect.any(Object),
			);
		});
	});

	describe('extractW9 operation', () => {
		it('posts to /w9s/', async () => {
			setParams(exec, {
				operation: 'extractW9',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/w9s/', expect.any(Object));
		});
	});

	describe('extractW2 operation', () => {
		it('posts to /w2s/', async () => {
			setParams(exec, {
				operation: 'extractW2',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/w2s/', expect.any(Object));
		});
	});

	describe('extractDriverLicense operation', () => {
		it('posts to /any-documents/ with blueprint_name=us_driver_license', async () => {
			setParams(exec, {
				operation: 'extractDriverLicense',
				binaryPropertyName: 'data',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

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
			setParams(exec, {
				operation: 'extractPassport',
				binaryPropertyName: 'data',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

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
			setParams(exec, {
				operation: 'extractAnyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				blueprintName: 'utility_bill',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

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
			setParams(exec, {
				operation: 'extractAnyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				blueprintName: '',
				additionalOptions: {},
			});

			await expect(node.execute.call(exec)).rejects.toThrow(/blueprint name is required/i);
		});
	});

	describe('classifyDocument operation', () => {
		it('posts to /classify/ without document_types when none supplied', async () => {
			setParams(exec, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: [],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			const result = await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/classify/', {
				file_data: EXPECTED_BASE64,
				file_name: TEST_FILE_NAME,
			});
			expect(result).toEqual([[{ json: mockClassifyResponse, pairedItem: { item: 0 } }]]);
		});

		it('forwards document_types when supplied', async () => {
			setParams(exec, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['invoice', 'receipt'],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.objectContaining({
					document_types: ['invoice', 'receipt'],
				}),
			);
		});

		it('strips empty / whitespace-only entries from document_types', async () => {
			setParams(exec, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['invoice', '', '  ', '\treceipt  '],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.objectContaining({
					document_types: ['invoice', 'receipt'],
				}),
			);
		});

		it('omits document_types entirely when all entries are blank', async () => {
			setParams(exec, {
				operation: 'classifyDocument',
				binaryPropertyName: 'data',
				fileName: '',
				documentTypes: ['', '   ', '\t\n'],
			});
			apiSpy.mockResolvedValue(mockClassifyResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith(
				'POST',
				'/api/v8/partner/classify/',
				expect.not.objectContaining({ document_types: expect.anything() }),
			);
		});
	});

	describe('error handling', () => {
		it('continues on fail when continueOnFail is true', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			exec.continueOnFail.mockReturnValue(true);
			apiSpy.mockRejectedValue(new Error('boom'));

			const [[item]] = await node.execute.call(exec);

			expect(item.json).toEqual({ error: 'boom' });
			expect(item.pairedItem).toEqual({ item: 0 });
		});

		it('rethrows when continueOnFail is false', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockRejectedValue(new Error('boom'));

			await expect(node.execute.call(exec)).rejects.toThrow('boom');
		});
	});

	describe('multiple input items', () => {
		it('runs once per item and tags pairedItem', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				binaryPropertyName: 'data',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			exec.getInputData.mockReturnValue([{ json: {} }, { json: {} }]);
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			const [items] = await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledTimes(2);
			expect(items).toHaveLength(2);
			expect(items[0].pairedItem).toEqual({ item: 0 });
			expect(items[1].pairedItem).toEqual({ item: 1 });
		});
	});

	describe('url input mode', () => {
		it('sends file_url instead of file_data when fileSource is url', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: 'https://example.com/invoice.pdf',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(exec.helpers.getBinaryDataBuffer).not.toHaveBeenCalled();
			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/documents/', {
				file_url: 'https://example.com/invoice.pdf',
			});
		});

		it('passes the user-supplied file_name when present in url mode', async () => {
			setParams(exec, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: 'https://example.com/invoice.pdf',
				fileName: 'override.pdf',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

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
			setParams(exec, {
				operation: 'extractInvoice',
				fileSource: 'url',
				fileUrl: '',
				fileName: '',
				confidenceDetails: false,
				flattenConfidence: true,
				additionalOptions: {},
			});

			await expect(node.execute.call(exec)).rejects.toThrow(/file URL is required/i);
		});

		it('still works for blueprint-based ops (driver license) in url mode', async () => {
			setParams(exec, {
				operation: 'extractDriverLicense',
				fileSource: 'url',
				fileUrl: 'https://example.com/dl.jpg',
				fileName: '',
				additionalOptions: {},
			});
			apiSpy.mockResolvedValue(mockVeryfiResponse);

			await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('POST', '/api/v8/partner/any-documents/', {
				file_url: 'https://example.com/dl.jpg',
				blueprint_name: 'us_driver_license',
			});
		});
	});

	describe('listBlueprints operation', () => {
		it('GETs /blueprints/ and emits one item per blueprint', async () => {
			setParams(exec, {
				resource: 'blueprint',
				operation: 'listBlueprints',
			});
			apiSpy.mockResolvedValue({
				blueprints: [
					{ name: 'us_driver_license', document_type: 'driver_license' },
					{ name: 'utility_bill', document_type: 'utility_bill' },
				],
			});

			const [items] = await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledWith('GET', '/api/v8/partner/blueprints/');
			expect(items).toHaveLength(2);
			expect(items[0].json).toEqual({
				name: 'us_driver_license',
				document_type: 'driver_license',
			});
			expect(items[0].pairedItem).toEqual({ item: 0 });
		});

		it('emits zero items when the account has no blueprints', async () => {
			setParams(exec, {
				resource: 'blueprint',
				operation: 'listBlueprints',
			});
			apiSpy.mockResolvedValue({ blueprints: [] });

			const [items] = await node.execute.call(exec);

			expect(items).toHaveLength(0);
		});

		it('runs once regardless of input item count (does not multiply per item)', async () => {
			setParams(exec, {
				resource: 'blueprint',
				operation: 'listBlueprints',
			});
			exec.getInputData.mockReturnValue([{ json: {} }, { json: {} }, { json: {} }]);
			apiSpy.mockResolvedValue({
				blueprints: [{ name: 'utility_bill', document_type: 'utility_bill' }],
			});

			const [items] = await node.execute.call(exec);

			expect(apiSpy).toHaveBeenCalledTimes(1);
			expect(items).toHaveLength(1);
			expect(items[0].pairedItem).toEqual({ item: 0 });
		});

		it('respects continueOnFail when the API call errors', async () => {
			setParams(exec, {
				resource: 'blueprint',
				operation: 'listBlueprints',
			});
			exec.continueOnFail.mockReturnValue(true);
			apiSpy.mockRejectedValue(new Error('upstream down'));

			const [[item]] = await node.execute.call(exec);

			expect(item.json).toEqual({ error: 'upstream down' });
			expect(item.pairedItem).toEqual({ item: 0 });
		});
	});
});
