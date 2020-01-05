// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import qs from 'qs';
import { Id, CollectionOptions } from './types';

export type RequestConfigModifier = (requestConfig: AjaxRequestConfig, value: string) => void;
export type FilterRequestConfigModifier =
  (requestConfig: AjaxRequestConfig, filters: Record<string, string | undefined>) => void;

export type ItemRequestConfigModifier<T> = (requestConfig: AjaxRequestConfig, item: T) => void;
export type ListRequestConfigModifier<T> =
  (requestConfig: AjaxRequestConfig, options: CollectionOptions, pageIndex?: number) => void;

export class ResponseError extends Error {
  request: Request;
  response: Response;
  responseData?: any;

  constructor(request: Request, response: Response, responseData?: any, ...args: any[]) {
    super(...args);
    this.request = request;
    this.response = response;
    this.responseData = responseData;
  }
}

export interface AjaxResponseOverride {
  status: number,
  statusText?: string,
  headers?: Record<string, string>,
  responseData?: any,
}

export interface AjaxRequestConfig extends RequestInit {
  client?: AjaxClient;
  baseUrl?: string;
  url?: string;
  headers: Record<string, string>;
  queryParams: Record<string, string | number | boolean>;
  bodyParams: Record<string, string>;
  context: any;

  onRequest?: (request: AjaxRequest) => Promise<boolean> | boolean;
  onResponse?: (response: Response, request: AjaxRequest) => Promise<boolean> | boolean;
}

const NESTED_OBJECT_KEYS: (keyof AjaxRequestConfig)[] = ['headers', 'queryParams', 'bodyParams'];

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

export class AjaxRequest {
  config: AjaxRequestConfig;
  request?: Request;
  response?: Response;
  responseData?: any;

  constructor(config: AjaxRequestConfig) {
    this.config = config;
  }

  fetch(parseJsonBody: Boolean = false): Promise<Response> {
    return new Promise<Response>(async (resolve, reject) => {
      try {
        if (this.config.onRequest) {
          const shouldContinueMakingRequest = await this.config.onRequest(this);
          if (!shouldContinueMakingRequest) return;
        }
        this.request = await this.createRequest();
        if (this.config.client) {
          this.config.client.requests.push(this);
          if (this.config.client.responseOverride) {
            this.response = new Response(null, this.config.client.responseOverride);
            this.responseData = this.config.client.responseOverride.responseData;
          }
        }
        if (!this.response) {
          // TODO: Handle timeout via fetch signal.
          // NOTE: Previous implementation of AbortSignal caused login to fail.
          this.response = await fetch(this.request);
          if (parseJsonBody) {
            this.responseData = this.parseJsonFromResponse();
          }
        }

        if (this.config.onResponse) {
          const shouldContinueHandlingResponse = await this.config.onResponse(this.response, this);
          if (!shouldContinueHandlingResponse) return;
        }

        if (!this.response.ok) {
          throw new ResponseError(
            this.request,
            this.response,
            this.responseData,
            `Response error: status ${this.response.status} ${this.response.statusText}`,
          );
        }

        resolve(this.response);
      } catch (error) {
        reject(error);
      }
    });
  }

  async fetchJson() {
    await this.fetch(true);
    return this.responseData;
  }

  private async createRequest() {
    let requestConfig = cloneRequestConfig(this.config);

    let url = (requestConfig.baseUrl || '') + (requestConfig.url || '');
    if (!requestConfig.method) {
      requestConfig.method = 'GET';
    }

    const queryParamsString = qs.stringify(requestConfig.queryParams);
    if (queryParamsString) {
      const urlHasQueryString = (url.indexOf('?') !== -1);
      url = url + (urlHasQueryString ? '&' : '?') + queryParamsString;
    }
    const bodyParamsString = qs.stringify(requestConfig.bodyParams);
    if (bodyParamsString) {
      requestConfig.body = bodyParamsString;
    }

    delete requestConfig.client;
    delete requestConfig.baseUrl;
    delete requestConfig.url;
    delete requestConfig.queryParams;
    delete requestConfig.bodyParams;
    delete requestConfig.context;
    delete requestConfig.onRequest;

    return new Request(url, requestConfig);
  }

  async parseJsonFromResponse() {
    const request = this.request!;
    const response = this.response!;
    let responseData;
    const responseClone = response.clone();
    try {
      responseData = await response.json();
    } catch (error) {
      const contentLength = response.headers.get('Content-Length');
      if (!contentLength || parseInt(contentLength, 10) !== 0) {
        const body = await responseClone.text();
        if (body.length) {
          throw new ResponseError(request, response, responseData,
            'Response error: Failed to parse body with application/json content type');
        }
      }
    }
    return responseData;
  }
}

function cloneRequestConfig(sourceConfig: Partial<AjaxRequestConfig>): AjaxRequestConfig {
  return mergeRequestConfig({} as AjaxRequestConfig, sourceConfig);
}

function mergeRequestConfig(targetConfig: AjaxRequestConfig, ...sourceConfigs: Partial<AjaxRequestConfig>[]): AjaxRequestConfig {
  // TODO: clonedeep?
  Object.assign(targetConfig, ...sourceConfigs);
  NESTED_OBJECT_KEYS.forEach((key: keyof AjaxRequestConfig) => {
    targetConfig[key] = {};
    sourceConfigs.forEach(config => {
      if (config[key]) {
        Object.assign(targetConfig[key], config[key]);
      }
    });
  });
  return targetConfig;
}

function getParamsString(params: URLSearchParams | undefined) {
  return params ? params.toString() : '';
}
