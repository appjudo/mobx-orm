// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

/* eslint-env browser */

import qs from 'qs';
import lodash from 'lodash';

import AjaxClient from './AjaxClient';
import Model from './Model';
import { Awaitable, CollectionOptions, Filters, HeadersRecord, Id, ParamsRecord } from './types';

export interface AjaxRequestConfig extends Omit<RequestInit, 'headers'> {
  headers: HeadersRecord;
  bodyParams: ParamsRecord;
  queryParams: ParamsRecord;

  client?: AjaxClient;
  baseUrl?: string;
  url?: string;
  bodyJsonData?: any;
  context: any;

  onRequest?: (request: AjaxRequest) => Awaitable<AjaxRequest | null>;
  onResponse?: (response: Response, request: AjaxRequest) => Awaitable<Response | null>;
  onResponseError?: (responseError: ResponseError, retry: Function, reject: Function) =>
    Awaitable<ResponseError | Response | null>;
}

export type RequestConfigModifier = (requestConfig: AjaxRequestConfig, value: string) => void;
export type FilterRequestConfigModifier = (requestConfig: AjaxRequestConfig, filters: Filters) => void;

export type IdRequestConfigModifier<U = void> = (requestConfig: AjaxRequestConfig, id: Id) => U;
export type ItemRequestConfigModifier<T extends Model<any>, U = void> =
  (requestConfig: AjaxRequestConfig, item: Partial<T>) => U;
export type ListRequestConfigModifier<T extends Model<any>, U = void> =
  (requestConfig: AjaxRequestConfig, options: CollectionOptions<T>, pageIndex?: number) => U;

export type IdMapper<U> = (id: Id) => U;
export type ItemMapper<T extends Model<any>, U> = (item: Partial<T>) => U;
export type ListOptionsMapper<T extends Model<any>, U> =
  (options: CollectionOptions<T>, pageIndex?: number) => U;

export interface RequestMapperResult {
  headers?: HeadersRecord;
  queryParams?: ParamsRecord;
  body?: BodyInit;
  bodyJsonData?: any;
  bodyParams?: ParamsRecord;
}

export type RequestMapper<T> = (value: T) => RequestMapperResult;

export type IdRequestMapper = IdMapper<RequestMapperResult>;
export type ItemRequestMapper<T extends Model<any>> = ItemMapper<T, RequestMapperResult>;
export type ListRequestMapper<T extends Model<any>> = ListOptionsMapper<T, RequestMapperResult>;

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

  constructor(config: Partial<AjaxRequestConfig>) {
    this.config = mergeRequestConfig({} as AjaxRequestConfig, config);
  }

  fetch(parseJsonBody: Boolean = false, attemptIndex: number = 0): Promise<Response> {
    this.promise = new Promise<Response>((resolve, reject) => {
      try {
        (async () => {
          if (this.config.onRequest) {
            const newRequest = await this.config.onRequest(this);
            if (!newRequest) return;
            // TODO: onRequest should return an AjaxRequestConfig, not a different AjaxRequest.
            this.config = newRequest.config;
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
        })().catch(error => reject(error));
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
    const requestConfig = cloneRequestConfig(this.config);

    let url = (requestConfig.baseUrl || '') + (requestConfig.url || '');
    if (!requestConfig.method) {
      requestConfig.method = 'GET';
    }

    if (requestConfig.headers) {
      requestConfig.headers = removeUndefinedValues(requestConfig.headers);
    }

    if (requestConfig.queryParams) {
      const queryParamsString = qs.stringify(removeUndefinedValues(requestConfig.queryParams));
      if (queryParamsString) {
        const urlHasQueryString = (url.indexOf('?') !== -1);
        url = url + (urlHasQueryString ? '&' : '?') + queryParamsString;
      }
    }

    if (!requestConfig.body) {
      if (requestConfig.bodyJsonData) {
        requestConfig.body = JSON.stringify(removeUndefinedValues(requestConfig.bodyJsonData));
      } else if (requestConfig.bodyParams) {
        const bodyParamsString = qs.stringify(removeUndefinedValues(requestConfig.bodyParams));
        if (bodyParamsString) {
          requestConfig.body = bodyParamsString;
        }
      }
    }

    delete requestConfig.client;
    delete requestConfig.baseUrl;
    delete requestConfig.url;
    delete requestConfig.queryParams;
    delete requestConfig.bodyJsonData;
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
  NESTED_OBJECT_KEYS.forEach((configKey: keyof AjaxRequestConfig) => {
    if (!targetConfig[configKey]) targetConfig[configKey] = {};
  });
  sourceConfigs.forEach(sourceConfig => {
    Object.assign(targetConfig, lodash.omit(sourceConfig, NESTED_OBJECT_KEYS));
    NESTED_OBJECT_KEYS.forEach((configKey: keyof AjaxRequestConfig) => {
      if (sourceConfig[configKey]) {
        Object.assign(targetConfig[configKey], sourceConfig[configKey]);
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

function removeUndefinedValues(data: any): any {
  if (lodash.isArray(data)) {
    return lodash.without(data, undefined).map(removeUndefinedValues);
  }
  if (lodash.isObject(data)) {
    return lodash.omitBy(data, key => data[key] === undefined);
  }
  return data;
}
