// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action } from 'mobx';
import AjaxClient, {
  AjaxRequest,
  AjaxRequestConfig,
  FilterRequestConfigModifier,
  ItemRequestConfigModifier,
  ListRequestConfigModifier,
  RequestConfigModifier,
} from './AjaxClient';
import Repository from './Repository';
import {
  DynamicUrl,
  Id,
  ItemResponseMapper,
  List,
  ListOptions,
  ListResponseMapper,
  ModelObject,
  StaticUrl,
  Url,
} from './types';

export interface AjaxRepositoryConfig<T> {
  client?: AjaxClient;
  baseUrl?: string;

  listUrl?: StaticUrl;
  listMethod?: string;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseMapper: ListResponseMapper<T>;

  getByIdUrl?: DynamicUrl<Id>;
  getByIdMethod?: string;
  getByIdResponseMapper: ItemResponseMapper<T>;

  addUrl?: Url<T>;
  addMethod?: string;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseMapper?: ItemResponseMapper<T>;

  updateUrl?: DynamicUrl<T>;
  updateMethod?: string;
  updateRequestConfigModifier?: ItemRequestConfigModifier<any>;
  updateResponseMapper?: ItemResponseMapper<T>;

  deleteUrl?: DynamicUrl<T>;
  deleteMethod?: string;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseMapper?: ItemResponseMapper<any>;

  deleteAllUrl?: StaticUrl;
  deleteAllMethod?: string;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseMapper?: ListResponseMapper<any>;

  sort?: RequestConfigModifier;
  search?: RequestConfigModifier;
  filter?: FilterRequestConfigModifier;

  requestContext?: () => any;
}

const REQUIRED_CONFIG_KEYS: (keyof AjaxRepositoryConfig<any>)[] = [
  'getByIdResponseMapper',
  'listResponseMapper',
];

const defaultCollectionUrl = function<T extends ModelObject> (this: AjaxRepository<T>) {
  return this.listUrl;
}

const defaultMemberIdUrl = function<T extends ModelObject> (this: AjaxRepository<T>, id: Id) {
  return `${this.listUrl}/${id}`;
}

const defaultMemberUrl = function<T extends ModelObject> (this: AjaxRepository<T>, item: T) {
  return `${this.listUrl}/${item.id}`;
}

export default class AjaxRepository<T extends ModelObject> extends Repository<T> {
  client: AjaxClient;
  baseUrl?: string;

  listMethod: string = 'GET';
  listUrl?: StaticUrl;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseMapper: ListResponseMapper<T>;

  getByIdMethod: string = 'GET';
  getByIdUrl: DynamicUrl<Id> = defaultMemberIdUrl;
  getByIdRequestConfigModifier?: ItemRequestConfigModifier<string>;
  getByIdResponseMapper: ItemResponseMapper<T>;

  addMethod: string = 'POST';
  addUrl: Url<T> = defaultCollectionUrl;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseMapper: ItemResponseMapper<T> = () => undefined;

  updateMethod: string = 'PATCH';
  updateUrl: DynamicUrl<T> = defaultMemberUrl;
  updateRequestConfigModifier?: ItemRequestConfigModifier<any>;
  updateResponseMapper: ItemResponseMapper<T> = () => undefined;

  deleteMethod: string = 'DELETE';
  deleteUrl: DynamicUrl<T> = defaultMemberUrl;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseMapper: ItemResponseMapper<T> = (data: any) => data;

  deleteAllMethod: string = 'DELETE';
  deleteAllUrl?: StaticUrl;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseMapper: ListResponseMapper<T> = (data: any) => data;

  sort?: RequestConfigModifier;
  search?: RequestConfigModifier;
  filter?: FilterRequestConfigModifier;

  requestContext?: () => any;

  constructor(config: AjaxRepositoryConfig<T>) {
    super();
    REQUIRED_CONFIG_KEYS.forEach(key => {
      if (!config[key]) {
        throw new Error(`Must specify '${key}' in AjaxRepositoryConfig`);
      }
    });
    this.client = config.client || new AjaxClient();
    this.getByIdResponseMapper = config.getByIdResponseMapper;
    this.listResponseMapper = config.listResponseMapper;

    // Use list* as defaults for deleteAll*, then overwrite via `assign` from `config`.
    // TODO: Add collection* and member* properties to set generic default values.
    this.deleteAllUrl = config.listUrl;
    this.deleteAllRequestConfigModifier = config.listRequestConfigModifier;

    Object.assign(this, config);
  }

  @action list(options: ListOptions = {}, pageIndex?: number): Promise<List<T>> {
    const request = this.createRequest(this.listUrl, this.listMethod);
    this.applyListOptionsToRequest(request, options);
    if (this.listRequestConfigModifier) {
      this.listRequestConfigModifier(request.config, options, pageIndex);
    }
    return request.fetchJson().then((data: any) => this.listResponseMapper(data, request.config.context));
  }

  @action getById(id: string): Promise<T | undefined> {
    if (!id) {
      throw new Error(`getById called with no ID`);
    }
    const url = this.getByIdUrl ? this.getByIdUrl(id) : undefined;
    const request = this.createRequest(url, this.getByIdMethod);
    if (this.getByIdRequestConfigModifier) {
      this.getByIdRequestConfigModifier(request.config, id);
    }
    return request.fetchJson()
      .then((data: any) => this.getByIdResponseMapper(data, request.config.context))
      .catch((error: any) => {
        if (error.response && error.response.status === 404) {
          return undefined;
        }
        throw error;
      });
  }

  @action add(item: T): Promise<T | undefined> {
    if (!item) {
      throw new Error(`add called with no item`);
    }
    const request = this.createRequest(this.addUrl, this.addMethod, item);
    if (this.addRequestConfigModifier) {
      this.addRequestConfigModifier(request.config, item);
    }
    return request.fetchJson().then((data: any) => this.addResponseMapper(data, request.config.context));
  }

  @action update(item: T): Promise<T | undefined> {
    if (!item) {
      throw new Error(`update called with no item`);
    }
    const request = this.createRequest(this.updateUrl, this.updateMethod, item);
    if (this.updateRequestConfigModifier) {
      this.updateRequestConfigModifier(request.config, item);
    }
    return request.fetchJson().then((data: any) => {
      return this.updateResponseMapper(data, request.config.context);
    });
  }

  @action delete(item: T): Promise<any> {
    if (!item) {
      throw new Error(`delete called with no item`);
    }
    const request = this.createRequest(this.deleteUrl, this.deleteMethod, item);
    if (this.updateRequestConfigModifier) {
      this.updateRequestConfigModifier(request.config, item);
    }
    return request.fetchJson().then((data: any) => this.deleteResponseMapper(data, request.config.context));
  }

  @action deleteAll(options: ListOptions = {}): Promise<any> {
    const request = this.createRequest(this.deleteAllUrl, this.deleteAllMethod);
    this.applyListOptionsToRequest(request, options);
    if (this.deleteAllRequestConfigModifier) {
      this.deleteAllRequestConfigModifier(request.config, options);
    }
    return request.fetchJson().then((data: any) => this.deleteAllResponseMapper(data, request.config.context));
  }

  private applyListOptionsToRequest(request: AjaxRequest, options: ListOptions) {
    if (options.filters && Object.keys(options.filters).length) {
      const filterFunction = this.filter;
      if (!filterFunction) {
        throw new Error(`Repository has no filter function`);
      }
      filterFunction(request.config, options.filters);
    }
    if (options.sort) {
      let sortFunction = this.sort;
      if (!sortFunction) {
        throw new Error(`Repository has no sort function`);
      }
      sortFunction(request.config, options.sort);
    }
    if (options.search) {
      const searchFunction = this.search;
      if (!searchFunction) {
        throw new Error(`Repository has no search function`);
      }
      searchFunction(request.config, options.search);
    }
  }

  private createRequest(url?: Url<T>, method?: string, item?: T) {
    if (url && typeof url !== 'string') {
      if (!item) {
        throw new Error("Must provide item for dynamic URL");
      }
      url = url.call(this, item);
    }
    const options = {} as AjaxRequestConfig;
    if (method) {
      options.method = method;
    }
    if (this.requestContext) {
      options.context = this.requestContext();
    }
    const request: AjaxRequest = this.client.request(url, options);
    if (typeof this.baseUrl === 'string') {
      request.config.baseUrl = this.baseUrl;
    }
    return request;
  }
}
