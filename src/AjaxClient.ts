// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import {
  default as AjaxRequest,
  AjaxRequestConfig,
  cloneRequestConfig,
  mergeRequestConfig,
} from './AjaxRequest';

export interface AjaxResponseOverride {
  status: number,
  statusText?: string,
  headers?: Record<string, string>,
  responseData?: any,
}

export default class AjaxClient {
  config: AjaxRequestConfig;
  requests: AjaxRequest[];
  responseOverride?: AjaxResponseOverride;

  constructor(config: Partial<AjaxRequestConfig> = {}) {
    this.config = cloneRequestConfig(config);
    this.config.client = this;
    this.requests = [];
  }

  request(url?: string, options: Partial<AjaxRequestConfig> = {}) {
    const config = mergeRequestConfig({} as AjaxRequestConfig, this.config, options);
    if (url) {
      config.url = url;
    }
    return new AjaxRequest(config);
  }
}
