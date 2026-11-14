import { DIDWWSmsProvider } from '@novu/providers';
import { ChannelTypeEnum, ICredentials, SmsProviderIdEnum } from '@novu/shared';
import { BaseSmsHandler } from './base.handler';

export class DIDWWSmsHandler extends BaseSmsHandler {
  constructor() {
    super(SmsProviderIdEnum.DIDWW, ChannelTypeEnum.SMS);
  }

  buildProvider(credentials: ICredentials) {
    this.provider = new DIDWWSmsProvider({
      user: credentials.user,
      password: credentials.password,
      region: credentials.region,
      from: credentials.from,
    });
  }
}
