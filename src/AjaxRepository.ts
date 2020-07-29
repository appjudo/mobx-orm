// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action } from 'mobx';

import AjaxClient from './AjaxClient';
import AjaxRequest, {
  AjaxRequestConfig,
  FilterRequestConfigModifier,
  IdRequestConfigModifier,
  IdRequestMapper,
  ItemRequestConfigModifier,
  ItemRequestMapper,
  ListRequestConfigModifier,
  ListRequestMapper,
  RequestConfigModifier,
  RequestMapper,
  mergeRequestConfig,
} from './AjaxRequest';

import Model from './Model';
import Repository, { RepositoryContext, RepositoryContextBuilder } from './Repository';
import {
  CollectionOptions,
  Context,
  Filters,
  Id,
  ItemResponseBodyMapper,
  List,
  ListDeleteAllResponseBodyMapper,
  ListResponseBodyMapper,
} from './types';

export interface AjaxRepositoryContext<T extends Model<any>> extends RepositoryContext<T> {
  repository: AjaxRepository<T>;
}

export type AjaxRepositoryContextBuilder<T extends Model<any>> =
  AjaxRepositoryContext<T> | ((repository: AjaxRepository<T>) => any);

export type StaticUrl = string;
export type DynamicUrl<T extends Model<any>> = (params: UrlParams<T>) => StaticUrl | undefined;
export type Url<T extends Model<any>> = StaticUrl | DynamicUrl<T>;

export interface UrlParams<T extends Model<any>> {
  context: AjaxRepositoryContext<T>;
  member?: T;
  memberId?: Id;
}

export interface AjaxRepositoryConfig<T extends Model<any>> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl?: Url<T>;
  collectionRequestMapper?: ListRequestMapper<T>;
  collectionRequestConfigModifier?: ListRequestConfigModifier<T>;
  collectionResponseBodyMapper?: ListResponseBodyMapper<T>;

  memberBaseUrl?: Url<T>;
  memberUrl?: DynamicUrl<T>;
  memberRequestMapper?: ItemRequestMapper<T>;
  memberRequestConfigModifier?: ItemRequestConfigModifier<T>;
  memberResponseBodyMapper?: ItemResponseBodyMapper<T>;

  listMethod?: string;
  listUrl?: StaticUrl;
  listRequestMapper?: ListRequestMapper<T>;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseBodyMapper?: ListResponseBodyMapper<T>;

  getByIdMethod?: string;
  getByIdUrl?: DynamicUrl<T>;
  getByIdRequestMapper?: IdRequestMapper;
  getByIdRequestConfigModifier?: IdRequestConfigModifier;
  getByIdResponseBodyMapper?: ItemResponseBodyMapper<T>;

  addMethod?: string;
  addUrl?: Url<T>;
  addRequestMapper?: ItemRequestMapper<T>;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseBodyMapper?: ItemResponseBodyMapper<T>;

  updateMethod?: string;
  updateUrl?: DynamicUrl<T>;
  updateRequestMapper?: ItemRequestMapper<T>;
  updateRequestConfigModifier?: ItemRequestConfigModifier<any>;
  updateResponseBodyMapper?: ItemResponseBodyMapper<T>;

  deleteMethod?: string;
  deleteUrl?: DynamicUrl<T>;
  deleteRequestMapper?: ItemRequestMapper<T>;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseBodyMapper?: ItemResponseBodyMapper<any>;

  deleteAllMethod?: string;
  deleteAllUrl?: Url<T>;
  deleteAllRequestMapper?: ListRequestMapper<T>;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseBodyMapper?: ListDeleteAllResponseBodyMapper<any>;

  sortRequestMapper?: RequestMapper<string>;
  searchRequestMapper?: RequestMapper<string>;
  filterRequestMapper?: RequestMapper<Filters>;

  sortRequestConfigModifier?: RequestConfigModifier;
  searchRequestConfigModifier?: RequestConfigModifier;
  filterRequestConfigModifier?: FilterRequestConfigModifier;

  context?: AjaxRepositoryContextBuilder<T>;
}

export default class AjaxRepository<T extends Model<any>> extends Repository<T> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl: Url<T> = '';
  collectionRequestMapper?: ListRequestMapper<T>;
  collectionRequestConfigModifier?: ListRequestConfigModifier<T>;
  collectionResponseBodyMapper: ListResponseBodyMapper<T> = (data: any) => data;

  memberBaseUrl: Url<T> = function memberBaseUrl(this: AjaxRepository<T>, params) {
    return typeof this.collectionUrl === 'function' ? this.collectionUrl(params) : this.collectionUrl;
  };
  memberUrl: DynamicUrl<T> = function memberUrl(this: AjaxRepository<T>, params) {
    const {memberId} = params;
    const memberBaseUrl = typeof this.memberBaseUrl === 'string' ? this.memberBaseUrl : this.memberBaseUrl(params);
    return `${memberBaseUrl}/${memberId}`;
  };
  memberRequestMapper?: ItemRequestMapper<T>;
  memberRequestConfigModifier?: ItemRequestConfigModifier<T>;
  memberResponseBodyMapper: ItemResponseBodyMapper<T> = (data: any) => data;

  listMethod: string = 'GET';
  listUrl?: Url<T>;
  listRequestMapper?: ListRequestMapper<T>;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseBodyMapper?: ListResponseBodyMapper<T>;

  getByIdMethod: string = 'GET';
  getByIdUrl?: DynamicUrl<T>;
  getByIdRequestMapper?: IdRequestMapper;
  getByIdRequestConfigModifier?: IdRequestConfigModifier;
  getByIdResponseBodyMapper?: ItemResponseBodyMapper<T>;

  addMethod: string = 'POST';
  addUrl?: Url<T>;
  addRequestMapper?: ItemRequestMapper<T>;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseBodyMapper?: ItemResponseBodyMapper<T>;

  updateMethod: string = 'PATCH';
  updateUrl?: DynamicUrl<T>;
  updateRequestMapper?: ItemRequestMapper<T>;
  updateRequestConfigModifier?: ItemRequestConfigModifier<T>;
  updateResponseBodyMapper?: ItemResponseBodyMapper<T>;

  deleteMethod: string = 'DELETE';
  deleteUrl?: DynamicUrl<T>;
  deleteRequestMapper?: ItemRequestMapper<T>;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseBodyMapper?: ItemResponseBodyMapper<T>;

  deleteAllMethod: string = 'DELETE';
  deleteAllUrl?: Url<T>;
  deleteAllRequestMapper?: ListRequestMapper<T>;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseBodyMapper?: ListResponseBodyMapper<T>;

  sortRequestMapper?: RequestMapper<string>;
  searchRequestMapper?: RequestMapper<string>;
  filterRequestMapper?: RequestMapper<Filters>;

  sortRequestConfigModifier?: RequestConfigModifier;
  searchRequestConfigModifier?: RequestConfigModifier;
  filterRequestConfigModifier?: FilterRequestConfigModifier;

  context?: RepositoryContextBuilder<T>;

  modelObjectCache: Record<Id, T>;

  constructor(config: AjaxRepositoryConfig<T>) {
    super();
    Object.assign(this, config);
    this.modelObjectCache = {};
  }

  @action list(options: CollectionOptions<T> = {}, pageIndex?: number): Promise<List<T>> {
    const request = this.createRequest(this.listUrl || this.collectionUrl, this.listMethod, options.context);
    this.applyCollectionOptionsToRequest(request, options);

    const requestMapper = this.listRequestMapper || this.collectionRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(options, pageIndex));

    const requestConfigModifier = this.listRequestConfigModifier || this.collectionRequestConfigModifier;
    requestConfigModifier?.(request.config, options, pageIndex);

    const responseBodyMapper = this.listResponseBodyMapper || this.collectionResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheList);
  }

  @action getById(id: string, reload: boolean = false, context?: Context<T>): Promise<T | undefined> {
    if (!id) throw new Error('AjaxRepository method \`getById\` called without id argument');

    const cachedItem = this.modelObjectCache[id];
    if (cachedItem) {
      if (cachedItem._orm.isLoading) {
        return cachedItem._orm.promise!;
      }
      if (cachedItem.isFullyLoaded && !reload) {
        return Promise.resolve(cachedItem);
      }
    }

    const request = this.createRequest(this.getByIdUrl || this.memberUrl, this.getByIdMethod, context, id);
    if (this.getByIdRequestMapper) mergeRequestConfig(request.config, this.getByIdRequestMapper(id));
    this.getByIdRequestConfigModifier?.(request.config, id);

    const responseBodyMapper = this.getByIdResponseBodyMapper || this.memberResponseBodyMapper;
    const promise = request.fetchJson()
      .catch((error: any) => {
        if (error.response && error.response.status === 404) {
          return undefined;
        }
        throw error;
      })
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember)
      .then(action((item?: T) => {
        if (item) item._orm.isLoading = false;
        if (cachedItem) cachedItem._orm.isLoading = false;
        return item;
      }));

    if (cachedItem) {
      cachedItem._orm.loadingPromise = promise;
      cachedItem._orm.isLoading = true;
      if (!reload) {
        return Promise.resolve(cachedItem);
      }
    }

    return promise;
  }

  @action add(item: T, context?: Context<T>): Promise<T | undefined> {
    if (!item) throw new Error('AjaxRepository method \`add\` called without item argument');

    const request = this.createRequest(this.addUrl || this.collectionUrl, this.addMethod, context, item);

    const requestMapper = this.addRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(item));

    const requestConfigModifier = this.addRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, item);

    const responseBodyMapper = this.addResponseBodyMapper || this.memberResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember);
  }

  @action update(values: Partial<T>, context?: Context<T>): Promise<T | undefined> {
    if (!values) throw new Error('AjaxRepository method \`update\` called without values');

    const id = values[this.idKey] as unknown as string;
    if (!id) throw new Error(`AjaxRepository method \`update\` requires values to include \`${this.idKey}\``);

    const request = this.createRequest(this.updateUrl || this.memberUrl, this.updateMethod, context, id);

    const requestMapper = this.updateRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(values));

    const requestConfigModifier = this.updateRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, values);

    const responseBodyMapper = this.updateResponseBodyMapper || this.memberResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember);
  }

  @action delete(item: T, context?: Context<T>): Promise<any> {
    if (!item) throw new Error('AjaxRepository method \`delete\` called without item argument');

    const request = this.createRequest(this.deleteUrl || this.memberUrl, this.deleteMethod, context, item);

    const requestMapper = this.deleteRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(item));

    const requestConfigModifier = this.deleteRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, item);

    const responseBodyMapper = this.deleteResponseBodyMapper || this.memberResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then((result: any) => {
        this.uncacheItem(item);
        return result;
      });
  }

  @action deleteAll(options: CollectionOptions<T> = {}): Promise<any> {
    const request = this.createRequest(this.deleteAllUrl || this.collectionUrl, this.deleteAllMethod, options.context);
    this.applyCollectionOptionsToRequest(request, options);

    const requestMapper = this.deleteAllRequestMapper || this.collectionRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(options));

    const requestConfigModifier = this.deleteAllRequestConfigModifier || this.collectionRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, options);

    const responseBodyMapper = this.deleteAllResponseBodyMapper || this.collectionResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then((items: T[] | boolean) => {
        if (items === true) {
          this.resetCache();
          return [];
        }
        if (items === false) {
          throw new Error('Unexpected response to deleteAll request');
        }
        items.forEach(this.uncacheItem);
        return items;
      });
  }

  @action reload(item: T, context?: Context<T>): Promise<T | undefined> {
    if (!item.id) {
      throw new Error('Item must have `id` to reload');
    }
    if (!this.modelObjectCache[item.id]) {
      // Cache item so that getById will update this item instead of caching a different instance.
      this.modelObjectCache[item.id] = item;
    }
    return this.getById(item.id, true);
  }

  protected cacheList = action((list: List<T>) => {
    list.forEach((item: T, index: number) => {
      list[index] = this.cacheItem(item);
    });
    return list;
  });

  protected cacheMember = action((item?: T) => item && this.cacheItem(item));

  cacheItem = action((item: T) => {
    item._orm.repository = this;
    const itemId = item[this.idKey] as unknown as Id;
    if (!itemId) {
      return item;
    }
    const cachedItem = this.modelObjectCache[itemId];
    if (cachedItem) {
      Object.assign(cachedItem, item);
    } else {
      this.modelObjectCache[itemId] = item;
    }
    return cachedItem || item;
  });

  protected uncacheItem = action((item: T) => {
    const itemId = item[this.idKey] as unknown as Id;
    if (itemId) {
      delete this.modelObjectCache[itemId];
    }
  });

  protected resetCache = action(() => {
    this.modelObjectCache = {};
  });

  protected applyCollectionOptionsToRequest(request: AjaxRequest, options: CollectionOptions<T>) {
    if (options.filters && Object.keys(options.filters).length) {
      if (this.filterRequestConfigModifier) {
        this.filterRequestConfigModifier(request.config, options.filters);
      } else if (this.filterRequestMapper) {
        mergeRequestConfig(request.config, this.filterRequestMapper(options.filters));
      } else {
        throw new Error('AjaxRepository instance has no filter capability');
      }
    }
    if (options.sort) {
      if (this.sortRequestConfigModifier) {
        this.sortRequestConfigModifier(request.config, options.sort);
      } else if (this.sortRequestMapper) {
        mergeRequestConfig(request.config, this.sortRequestMapper(options.sort));
      } else {
        throw new Error('AjaxRepository instance has no sort capability');
      }
    }
    if (options.search) {
      if (this.searchRequestConfigModifier) {
        this.searchRequestConfigModifier(request.config, options.search);
      } else if (this.searchRequestMapper) {
        mergeRequestConfig(request.config, this.searchRequestMapper(options.search));
      } else {
        throw new Error('AjaxRepository instance has no search capability');
      }
    }
  }

  protected createRequest(url?: Url<T>, method?: string, context?: Context<T>, value?: Id | T) {
    const mergedContext = {
      repository: this,
      ...(typeof this.context === 'function' ? this.context(this) : this.context),
      ...context,
    };
    if (url && typeof url !== 'string') {
      const memberParams = typeof value === 'undefined' ? undefined : (
        typeof value === 'string'
          ? {memberId: value, member: this.modelObjectCache[value]}
          : {memberId: value.id, member: value}
      );
      url = url.call(this, {context: mergedContext, ...memberParams});
    }
    const options = {context} as AjaxRequestConfig;
    if (method) {
      options.method = method;
    }
    if (!this.client) {
      this.client = new AjaxClient();
    }
    const request: AjaxRequest = this.client.request(url, options);
    if (typeof this.baseUrl === 'string') {
      request.config.baseUrl = this.baseUrl;
    }
    return request;
  }

  getMemberId(value: Id | T) {
    if (typeof value === 'string') {
      return value;
    }
    return value[this.idKey];
  }
}

export function listPaginationRequestMapper<T extends Model<any>>(
  options: CollectionOptions<T>,
  pageIndex: number = 0,
) {
  return options.pageSize ? {
    queryParams: {
      pageSize: options.pageSize,
      startIndex: options.pageSize * pageIndex,
    },
  } : {};
}

export function listPaginationRequestConfigModifier<T extends Model<any>>(
  requestConfig: AjaxRequestConfig,
  options: CollectionOptions<T>,
  pageIndex: number = 0,
) {
  mergeRequestConfig(requestConfig, listPaginationRequestMapper(options, pageIndex));
}
