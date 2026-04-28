import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VeryfiApi implements ICredentialType {
	name = 'veryfiApi';

	displayName = 'Veryfi API';

	documentationUrl = 'https://github.com/veryfi/n8n-nodes-veryfi';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description:
				'Your Veryfi <strong>CLIENT ID</strong>. Find it on the <a target="_blank" href="https://app.veryfi.com/api/settings/keys/">Keys page</a>.',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description:
				'Your Veryfi <strong>USERNAME</strong>. Used only as part of the API authorization header (not as a domain or subdomain). Cannot contain spaces or colons.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Veryfi <strong>API KEY</strong>. Find it on the <a target="_blank" href="https://app.veryfi.com/api/settings/keys/">Keys page</a>.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'CLIENT-ID': '={{$credentials.clientId}}',
				Authorization: '=apikey {{$credentials.username}}:{{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.veryfi.com',
			url: '/api/v8/partner/documents/schema/',
			method: 'GET',
		},
	};
}
