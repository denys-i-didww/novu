import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIDWWSmsProvider } from './didww.provider';

vi.mock('axios');

describe('DIDWWSmsProvider', () => {
  const mockConfig = {
    user: 'trunk-user',
    password: 'trunk-password',
    from: '12125551234',
  };

  const mockSuccessResponse = {
    status: 201,
    data: {
      data: {
        type: 'outbound_messages',
        id: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  };

  let provider: DIDWWSmsProvider;

  beforeEach(() => {
    // The provider builds its client through `createProviderHttpClient`, so point the
    // instance's `post` back at the module-level mock these tests assert on.
    vi.mocked(axios.create).mockReturnValue({ post: axios.post } as never);
    provider = new DIDWWSmsProvider(mockConfig);
    vi.clearAllMocks();
  });

  it('should send an SMS message successfully', async () => {
    vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

    const result = await provider.sendMessage({
      to: '15551234567',
      content: 'Hello from DIDWW!',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://sms-out.didww.com/outbound_messages',
      {
        data: {
          type: 'outbound_messages',
          attributes: {
            destination: '15551234567',
            source: '12125551234',
            content: 'Hello from DIDWW!',
          },
        },
      },
      {
        auth: { username: 'trunk-user', password: 'trunk-password' },
        headers: { 'Content-Type': 'application/vnd.api+json' },
      }
    );

    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      date: expect.any(String),
    });
  });

  it('should strip the leading "+" from E.164 phone numbers', async () => {
    vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

    await provider.sendMessage({ to: '+15551234567', content: 'Hello' });

    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({
      data: { attributes: { destination: '15551234567' } },
    });
  });

  it('should use the from field passed in the options over the config', async () => {
    vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

    await provider.sendMessage({ to: '15551234567', content: 'Hello', from: 'NovuSender' });

    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({
      data: { attributes: { source: 'NovuSender' } },
    });
  });

  it('should send to the regional endpoint when a region is set', async () => {
    vi.mocked(axios.create).mockReturnValue({ post: axios.post } as never);
    const euProvider = new DIDWWSmsProvider({ ...mockConfig, region: 'eu' });
    vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

    await euProvider.sendMessage({ to: '15551234567', content: 'Hello' });

    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('https://eu.sms-out.didww.com/outbound_messages');
  });

  it('should reject an unknown region without sending', async () => {
    vi.mocked(axios.create).mockReturnValue({ post: axios.post } as never);
    const badProvider = new DIDWWSmsProvider({ ...mockConfig, region: 'evil.example.com' });

    await expect(badProvider.sendMessage({ to: '15551234567', content: 'Hello' })).rejects.toThrow(
      'DIDWW SMS: unknown region "evil.example.com"'
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should merge passthrough attributes such as campaign_id', async () => {
    vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

    await provider.sendMessage(
      { to: '15551234567', content: 'Hello' },
      { _passthrough: { body: { data: { attributes: { campaign_id: 'campaign-1' } } } } }
    );

    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({
      data: { type: 'outbound_messages', attributes: { campaign_id: 'campaign-1', content: 'Hello' } },
    });
  });

  it('should throw with the API error detail on an HTTP error', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: { errors: [{ title: 'Bad Request', detail: 'Invalid request', code: '400', status: '400' }] },
      },
    });

    await expect(provider.sendMessage({ to: '15551234567', content: 'Hello' })).rejects.toThrow(
      'DIDWW SMS request failed (400): Invalid request'
    );
  });

  it('should rethrow network errors without a response', async () => {
    const networkError = new Error('socket hang up');
    vi.mocked(axios.post).mockRejectedValue(networkError);

    await expect(provider.sendMessage({ to: '15551234567', content: 'Hello' })).rejects.toBe(networkError);
  });

  it('should throw when the response has no message id', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 201, data: {} });

    await expect(provider.sendMessage({ to: '15551234567', content: 'Hello' })).rejects.toThrow(
      'DIDWW SMS request failed: message id missing from response'
    );
  });
});
