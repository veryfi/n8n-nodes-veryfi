import { transformConfidence } from '../GenericFunctions';

describe('Veryfi transformConfidence helper', () => {
	it('returns scalar values unchanged', () => {
		expect(transformConfidence(null)).toBeNull();
		expect(transformConfidence(undefined)).toBeUndefined();
		expect(transformConfidence(42)).toBe(42);
		expect(transformConfidence('hello')).toBe('hello');
	});

	it('passes plain (non-confidence) responses through unchanged', () => {
		const input = { invoice_number: '0998811', total: 329.74, tags: [] };
		expect(transformConfidence(input)).toEqual(input);
	});

	it('flattens a root-level confidence object', () => {
		const input = {
			invoice_number: { value: '0998811', score: 0.93, ocr_score: 0.98 },
		};
		const out = transformConfidence(input) as Record<string, unknown>;
		expect(out.invoice_number).toBe('0998811');
		expect(out.invoice_number__score).toBe(0.93);
		expect(out.invoice_number__ocr_score).toBe(0.98);
	});

	it('flattens nested confidence objects with double-underscore prefix', () => {
		const input = {
			vendor: {
				name: { value: 'Rumpke', score: 0.91, ocr_score: 0.97 },
				country_code: 'US',
			},
		};
		const out = transformConfidence(input) as Record<string, unknown>;
		const vendor = out.vendor as Record<string, unknown>;
		expect(vendor.name).toBe('Rumpke');
		expect(vendor.country_code).toBe('US');
		expect(out.vendor__name__score).toBe(0.91);
		expect(out.vendor__name__ocr_score).toBe(0.97);
	});

	it('unwraps confidence objects inside array elements', () => {
		const input = {
			line_items: [
				{
					description: { value: 'Widget', score: 0.88 },
					total: { value: 9.99, score: 0.95, ocr_score: 0.99 },
				},
				{ description: 'Plain', total: 1.0 },
			],
		};
		const out = transformConfidence(input) as Record<string, unknown>;
		const lineItems = out.line_items as Array<Record<string, unknown>>;
		expect(lineItems[0].description).toBe('Widget');
		expect(lineItems[0].total).toBe(9.99);
		expect(lineItems[1].description).toBe('Plain');
		expect(lineItems[1].total).toBe(1.0);
	});

	it('omits score keys when score / ocr_score are missing or null', () => {
		const input = {
			invoice_number: { value: '123', score: null },
		};
		const out = transformConfidence(input) as Record<string, unknown>;
		expect(out.invoice_number).toBe('123');
		expect(out.invoice_number__score).toBeUndefined();
		expect(out.invoice_number__ocr_score).toBeUndefined();
	});
});
