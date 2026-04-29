import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const VERYFI_BASE_URL = 'https://api.veryfi.com';

/**
 * Thin wrapper around `httpRequestWithAuthentication` for the Veryfi partner API.
 * Always sends JSON; injects credentials via the `veryfiApi` credential type.
 */
export async function veryfiApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: `${VERYFI_BASE_URL}${path}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		json: true,
	};

	if (Object.keys(body).length > 0) {
		options.body = body;
	}
	if (Object.keys(qs).length > 0) {
		options.qs = qs;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'veryfiApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Read an n8n binary input field, return a base64 string and the source filename.
 * Mirrors the file-handling done by the Veryfi Zapier and Make.com apps.
 */
export async function getFileAsBase64(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
): Promise<{ fileData: string; fileName?: string }> {
	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	return {
		fileData: buffer.toString('base64'),
		fileName: binaryData.fileName,
	};
}

/**
 * Load Veryfi blueprints for the dynamic dropdown on the "Extract from Any Document" operation.
 * Mirrors the hidden trigger in the Zapier app.
 */
export async function loadBlueprints(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = (await veryfiApiRequest.call(this, 'GET', '/api/v8/partner/blueprints/')) as {
		blueprints?: Array<{ name?: string; document_type?: string }>;
	};

	const blueprints = (response?.blueprints ?? [])
		.filter((b) => typeof b?.name === 'string' && b.name.length > 0)
		.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

	return blueprints.map((blueprint) => ({
		name: blueprint.document_type
			? `${blueprint.name} (${blueprint.document_type})`
			: (blueprint.name as string),
		value: blueprint.name as string,
	}));
}

/**
 * Flatten Veryfi's `confidence_details: true` response shape.
 *
 * When confidence details are requested, fields become objects of the form
 * `{ value, score, ocr_score }`. This helper hoists each `value` to the original
 * key and emits sibling keys `<key>__score` and `<key>__ocr_score` so users can
 * map the scalar values directly without expression gymnastics. Nested objects
 * (e.g. `vendor`, `bill_to`) are flattened one level using `__` as a separator.
 *
 * Direct TypeScript port of the Zapier `utils.js` helper.
 */
export function transformConfidence(input: unknown): unknown {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return input;
	}

	const result = input as IDataObject;
	const out: IDataObject = {};

	const isConfidenceObject = (val: unknown): val is IDataObject =>
		typeof val === 'object' && val !== null && !Array.isArray(val) && 'value' in val;

	const processConfidenceObject = (val: unknown, key: string): IDataObject => {
		if (isConfidenceObject(val)) {
			const obj = val;
			const fragment: IDataObject = { [key]: obj.value };
			if (obj.score !== undefined && obj.score !== null) {
				fragment[`${key}__score`] = obj.score;
			}
			if (obj.ocr_score !== undefined && obj.ocr_score !== null) {
				fragment[`${key}__ocr_score`] = obj.ocr_score;
			}
			return fragment;
		}
		return { [key]: val as IDataObject[keyof IDataObject] };
	};

	for (const key of Object.keys(result)) {
		const value = result[key];

		if (
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			!('value' in (value as IDataObject))
		) {
			const nested = value as IDataObject;
			const flat: IDataObject = {};
			for (const subKey of Object.keys(nested)) {
				const subValue = nested[subKey];
				const flattenedKey = `${key}__${subKey}`;
				if (isConfidenceObject(subValue)) {
					flat[subKey] = subValue.value;
					const processed = processConfidenceObject(subValue, flattenedKey);
					for (const pk of Object.keys(processed)) {
						if (pk !== flattenedKey) {
							out[pk] = processed[pk];
						}
					}
				} else {
					flat[subKey] = subValue as IDataObject[keyof IDataObject];
				}
			}
			out[key] = flat;
		} else if (Array.isArray(value)) {
			out[key] = value.map((item) => {
				if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
					const itemObj = item as IDataObject;
					const flatItem: IDataObject = {};
					for (const ik of Object.keys(itemObj)) {
						const iv = itemObj[ik];
						if (isConfidenceObject(iv)) {
							flatItem[ik] = iv.value;
						} else {
							flatItem[ik] = iv as IDataObject[keyof IDataObject];
						}
					}
					return flatItem;
				}
				return item;
			}) as unknown as IDataObject[keyof IDataObject];
		} else {
			Object.assign(out, processConfidenceObject(value, key));
		}
	}

	return out;
}
