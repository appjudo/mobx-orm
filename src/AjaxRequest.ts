// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import qs from 'qs';
import AjaxClient from './AjaxClient';
import { Awaitable, CollectionOptions } from './types';
import { Filters, Params } from './types';
import { isUndefined } from './utils';

export interface AjaxRequestConfig extends Omit<RequestInit, 'headers'> {
  client?: AjaxClient;
  baseUrl?: string;
  url?: string;
  headers: Record<string, string | undefined>;
  queryParams: Params;
  bodyParams: Params;
  context: any;

  onRequest?: (request: AjaxRequest) => Awaitable<AjaxRequest | null>;
  onResponse?: (response: Response, request: AjaxRequest) => Awaitable<Response | null>;
  onResponseError?: (responseError: ResponseError, retry: Function, reject: Function) =>
    Awaitable<ResponseError | Response | null>;
}

export type RequestConfigModifier = (requestConfig: AjaxRequestConfig, value: string) => void;
export type FilterRequestConfigModifier =
  (requestConfig: AjaxRequestConfig, filters: Filters) => void;

export type ItemRequestConfigModifier<T> = (requestConfig: AjaxRequestConfig, item: T) => void;
export type ListRequestConfigModifier<T> =
  (requestConfig: AjaxRequestConfig, options: CollectionOptions, pageIndex?: number) => void;

interface ResponseErrorOptions {
  request: Request;
  requestConfig: AjaxRequestConfig;
  requestAttemptIndex?: number;
  response: Response;
  responseData?: any;
}

export class ResponseError extends Error {
  request: Request;
  requestConfig: AjaxRequestConfig;
  requestAttemptIndex: number;
  response: Response;
  responseData?: any;

  constructor(options: ResponseErrorOptions, ...args: any[]) {
    super(...args);
    
    this.request = options.request;
    this.requestConfig = options.requestConfig;
    this.requestAttemptIndex = options.requestAttemptIndex || 0;
    this.response = options.response;
    this.responseData = options.responseData;
  }
}

const NESTED_OBJECT_KEYS: (keyof AjaxRequestConfig)[] = ['headers', 'queryParams', 'bodyParams'];

export default class AjaxRequest {
  config: AjaxRequestConfig;
  request?: Request;
  response?: Response;
  responseData?: any;
  retrying?: boolean;
  promise?: Promise<Response>;

  constructor(config: AjaxRequestConfig) {
    this.config = config;
  }

  fetch(parseJsonBody: Boolean = false, attemptIndex: number = 0): Promise<Response> {
    this.promise = new Promise<Response>(async (resolve, reject) => {
      try {
        if (this.config.onRequest) {
          const shouldContinueMakingRequest = await this.config.onRequest(this);
          if (!shouldContinueMakingRequest) return;
        }
        const [url, requestInit] = await this.prepareRequestInit();
        this.request = new Request(url, requestInit);
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
            this.responseData = await this.parseJsonFromResponse();
          }
        }

        if (this.config.onResponse) {
          const shouldContinueHandlingResponse = await this.config.onResponse(this.response, this);
          if (!shouldContinueHandlingResponse) return;
        }

        if (this.response.ok) {
          resolve(this.response);
          return;
        }

        const responseError = new ResponseError(
          {
            request: this.request,
            requestConfig: this.config,
            requestAttemptIndex: attemptIndex,
            response: this.response,
            responseData: this.responseData,
          },
          `Response error: status ${this.response.status} ${this.response.statusText}`,
        );
        
        if (this.config.onResponseError) {
          const retry = (requestConfig?: AjaxRequestConfig) => {
            this.retrying = true;
            if (requestConfig) this.config = requestConfig;
            resolve(this.fetch(parseJsonBody, attemptIndex + 1));
          };
          try {
            const shouldContinueHandlingResponse = await this.config.onResponseError(responseError, retry, reject);
            if (!shouldContinueHandlingResponse) return;
          } catch (error) {
            reject(error);
            return;
          }
        }

        reject(responseError);
      } catch (error) {
        reject(error);
      }
    });
    return this.promise;
  }

  async fetchJson() {
    await this.fetch(true);
    return this.responseData;
  }

  private async prepareRequestInit(): Promise<[string, RequestInit]> {
    let requestConfig = cloneRequestConfig(this.config);

    let url = (requestConfig.baseUrl || '') + (requestConfig.url || '');
    if (!requestConfig.method) {
      requestConfig.method = 'GET';
    }

    for (const name in requestConfig.headers) {
      if (isUndefined(requestConfig.headers[name])) {
        delete requestConfig.headers[name];
      }
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

    return [url, requestConfig as RequestInit];
  }

  async parseJsonFromResponse() {
    const request = this.request!;
    const requestConfig = this.config;
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
          throw new ResponseError(
            {request, requestConfig, response, responseData},
            'Response error: Failed to parse body with application/json content type',
          );
        }
      }
    }
    return responseData;
  }
}

export function cloneRequestConfig(sourceConfig: Partial<AjaxRequestConfig>): AjaxRequestConfig {
  return mergeRequestConfig({} as AjaxRequestConfig, sourceConfig);
}

export function mergeRequestConfig(targetConfig: AjaxRequestConfig, ...sourceConfigs: Partial<AjaxRequestConfig>[]): AjaxRequestConfig {
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

export function getObjectFromHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  const keyValuePairs = [...headers.entries()];
  keyValuePairs.forEach(([key, value]) => {
      result[key] = value;
  });
  return result;
}
