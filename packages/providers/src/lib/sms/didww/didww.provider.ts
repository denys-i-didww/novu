import { SmsProviderIdEnum } from '@novu/shared';
import { ChannelTypeEnum, ISendMessageSuccessResponse, ISmsOptions, ISmsProvider } from '@novu/stateless';
import type { AxiosError } from 'axios';
import { BaseProvider, CasingEnum } from '../../../base.provider';
import { createProviderHttpClient } from '../../../utils/http';
import { WithPassthrough } from '../../../utils/types';

const DIDWW_ENDPOINTS: Record<string, string> = {
  global: 'https://sms-out.didww.com',
  us: 'https://us.sms-out.didww.com',
  eu: 'https://eu.sms-out.didww.com',
  'mia.us': 'https://mia.us.sms-out.didww.com',
  'lac.us': 'https://lac.us.sms-out.didww.com',
  sg: 'https://sg.sms-out.didww.com',
};

type DIDWWResponse = { data?: { type?: string; id?: string } };
type DIDWWErrorResponse = { errors?: { title?: string; detail?: string }[] };

export class DIDWWSmsProvider extends BaseProvider implements ISmsProvider {
  id = SmsProviderIdEnum.DIDWW;
  channelType = ChannelTypeEnum.SMS as ChannelTypeEnum.SMS;
  protected casing = CasingEnum.SNAKE_CASE;
  private readonly httpClient = createProviderHttpClient();

  constructor(
    private config: {
      user?: string;
      password?: string;
      region?: string;
      from?: string;
    }
  ) {
    super();
  }

  async sendMessage(
    options: ISmsOptions,
    bridgeProviderData: WithPassthrough<Record<string, unknown>> = {}
  ): Promise<ISendMessageSuccessResponse> {
    const baseUrl = DIDWW_ENDPOINTS[this.config.region || 'global'];
    if (!baseUrl) {
      throw new Error(`DIDWW SMS: unknown region "${this.config.region}"`);
    }

    const payload = this.transform(bridgeProviderData, {
      data: {
        type: 'outbound_messages',
        attributes: {
          destination: options.to.replace(/^\+/, ''),
          source: options.from || this.config.from,
          content: options.content,
        },
      },
    });

    const response = await this.httpClient
      .post<DIDWWResponse>(`${baseUrl}/outbound_messages`, payload.body, {
        auth: { username: this.config.user ?? '', password: this.config.password ?? '' },
        headers: {
          'Content-Type': 'application/vnd.api+json',
          ...payload.headers,
        },
      })
      .catch((error: AxiosError<DIDWWErrorResponse>) => {
        const status = error?.response?.status;
        if (!status) throw error;

        const apiError = error.response?.data?.errors?.[0];
        throw new Error(
          `DIDWW SMS request failed (${status}): ${apiError?.detail || apiError?.title || error.message}`
        );
      });

    const id = response.data?.data?.id;
    if (!id) {
      throw new Error('DIDWW SMS request failed: message id missing from response');
    }

    return {
      id,
      date: new Date().toISOString(),
    };
  }
}
