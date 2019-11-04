// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import qs from 'qs';
import { Id, CollectionOptions } from './types';

export type RequestConfigModifier = (requestConfig: AjaxRequestConfig, value: string) => void;
export type FilterRequestConfigModifier =
  (requestConfig: AjaxRequestConfig, filters: Record<string, string>) => void;

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

export interface AjaxRequestConfig extends RequestInit {
  client?: AjaxClient;
  baseUrl?: string;
  url?: string;
  headers: Record<string, string>;
  queryParams: Record<string, string | number | boolean>;
  bodyParams: Record<string, string>;
  context: any;

  onRequest?: (requestConfig: AjaxRequestConfig) => Promise<AjaxRequestConfig | void> | AjaxRequestConfig | void;
}

const NESTED_OBJECT_KEYS: (keyof AjaxRequestConfig)[] = ['headers', 'queryParams', 'bodyParams'];

export default class AjaxClient {
  config: AjaxRequestConfig;
  requests: AjaxRequest[];

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

  async fetch() {
    let requestConfig = cloneRequestConfig(this.config);

    if (requestConfig.onRequest) {
      const newRequestConfig = await requestConfig.onRequest(requestConfig);
      if (newRequestConfig) {
        requestConfig = newRequestConfig;
      }
    }

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

    const request = new Request(url, requestConfig);
    this.request = request;
    if (this.config.client) {
      this.config.client.requests.push(this);
    }
    // TODO: Handle timeout via fetch signal.
    // NOTE: Previous implementation of AbortSignal caused login to fail.
    return await fetch(request).then(async (response: Response) => {
      this.response = response;
      if (!response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        let responseData;
        if (contentType.indexOf('application/json') !== -1) {
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
        }
        throw new ResponseError(request, response, responseData, `Response error: status ${response.status} ${response.statusText}`);
      }
      return response;
    });
  }

  fetchJson() {
    return this.fetch()
      .then((response: Response) => response.json())
      .then((data: any) => {
        this.responseData = data;
        return data;
      });
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
