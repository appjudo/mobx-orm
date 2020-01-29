// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action } from 'mobx';

import AjaxClient, {
  AjaxRequest,
  AjaxRequestConfig,
  FilterRequestConfigModifier,
  ItemRequestConfigModifier,
  ListRequestConfigModifier,
  RequestConfigModifier,
} from './AjaxClient';
import Model from './Model';
import Repository from './Repository';
import {
  DynamicUrl,
  Id,
  ItemResponseMapper,
  List,
  CollectionOptions,
  ListResponseMapper,
  StaticUrl,
  Url,
} from './types';

export interface AjaxRepositoryConfig<T> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl?: StaticUrl;
  collectionRequestConfigModifier?: ListRequestConfigModifier<T>;
  collectionResponseMapper?: ListResponseMapper<T>;

  memberBaseUrl?: Url<T>;
  memberUrl?: DynamicUrl<T>;
  memberRequestConfigModifier?: ItemRequestConfigModifier<T>;
  memberResponseMapper?: ItemResponseMapper<T>;

  listMethod?: string;
  listUrl?: StaticUrl;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseMapper?: ListResponseMapper<T>;

  getByIdMethod?: string;
  getByIdUrl?: DynamicUrl<T>;
  getByIdRequestConfigModifier?: ItemRequestConfigModifier<string>;
  getByIdResponseMapper?: ItemResponseMapper<T>;

  addMethod?: string;
  addUrl?: Url<T>;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseMapper?: ItemResponseMapper<T>;

  updateMethod?: string;
  updateUrl?: DynamicUrl<T>;
  updateRequestConfigModifier?: ItemRequestConfigModifier<any>;
  updateResponseMapper?: ItemResponseMapper<T>;

  deleteMethod?: string;
  deleteUrl?: DynamicUrl<T>;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseMapper?: ItemResponseMapper<any>;

  deleteAllMethod?: string;
  deleteAllUrl?: StaticUrl;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseMapper?: ListResponseMapper<any>;

  sort?: RequestConfigModifier;
  search?: RequestConfigModifier;
  filter?: FilterRequestConfigModifier;

  requestContext?: () => any;
}

export default class AjaxRepository<T extends Model<any>> extends Repository<T> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl: StaticUrl = '';
  collectionRequestConfigModifier?: ListRequestConfigModifier<T>;
  collectionResponseMapper: ListResponseMapper<T> = (data: any) => data;

  memberBaseUrl: Url<T> = function (this: AjaxRepository<T>) {
    return this.collectionUrl;
  };
  memberUrl: DynamicUrl<T> = function (this: AjaxRepository<T>, value: Id | T) {
    const memberBaseUrl = typeof this.memberBaseUrl === 'string' ? this.memberBaseUrl : this.memberBaseUrl(value);
    const id = this.getMemberId(value);
    return `${memberBaseUrl}/${id}`;
  };
  memberRequestConfigModifier?: ItemRequestConfigModifier<T>;
  memberResponseMapper: ItemResponseMapper<T> = (data: any) => data;

  listMethod: string = 'GET';
  listUrl?: StaticUrl;
  listRequestConfigModifier?: ListRequestConfigModifier<T>;
  listResponseMapper?: ListResponseMapper<T>;

  getByIdMethod: string = 'GET';
  getByIdUrl?: DynamicUrl<T>;
  getByIdRequestConfigModifier?: ItemRequestConfigModifier<string>;
  getByIdResponseMapper?: ItemResponseMapper<T>;

  addMethod: string = 'POST';
  addUrl?: Url<T>;
  addRequestConfigModifier?: ItemRequestConfigModifier<T>;
  addResponseMapper?: ItemResponseMapper<T>;

  updateMethod: string = 'PATCH';
  updateUrl?: DynamicUrl<T>;
  updateRequestConfigModifier?: ItemRequestConfigModifier<any>;
  updateResponseMapper?: ItemResponseMapper<T>;

  deleteMethod: string = 'DELETE';
  deleteUrl?: DynamicUrl<T>;
  deleteRequestConfigModifier?: ItemRequestConfigModifier<T>;
  deleteResponseMapper?: ItemResponseMapper<T>;

  deleteAllMethod: string = 'DELETE';
  deleteAllUrl?: StaticUrl;
  deleteAllRequestConfigModifier?: ListRequestConfigModifier<T>;
  deleteAllResponseMapper?: ListResponseMapper<T>;

  sort?: RequestConfigModifier;
  search?: RequestConfigModifier;
  filter?: FilterRequestConfigModifier;

  requestContext?: () => any;

  modelObjectCache: Record<Id, T>;

  constructor(config: AjaxRepositoryConfig<T>) {
    super();
    Object.assign(this, config);
    this.modelObjectCache = {};
  }

  @action list(options: CollectionOptions = {}, pageIndex?: number): Promise<List<T>> {
    const request = this.createRequest(this.listUrl || this.collectionUrl, this.listMethod);
    this.applyCollectionOptionsToRequest(request, options);
    
    const requestConfigModifier = this.listRequestConfigModifier || this.collectionRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, options, pageIndex);

    const responseMapper = this.listResponseMapper || this.collectionResponseMapper;
    return request.fetchJson()
      .then((data: any) => responseMapper(data, request.config.context))
      .then(this.cacheList);
  }

  @action getById(id: string, reload: boolean = false): Promise<T | undefined> {
    if (!id) throw new Error('AjaxRepository method \'getById\' called without id argument');

    const cachedItem = this.modelObjectCache[id];
    if (cachedItem) {
      if (cachedItem._isLoading) {
        return cachedItem._promise!;
      }
      if (cachedItem.isFullyLoaded && !reload) {
        return Promise.resolve(cachedItem);
      }
    }

    const request = this.createRequest(this.getByIdUrl || this.memberUrl, this.getByIdMethod, id);
    const requestConfigModifier = this.getByIdRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, id);

    const responseMapper = this.getByIdResponseMapper || this.memberResponseMapper;
    const promise = request.fetchJson()
      .catch((error: any) => {
        if (error.response && error.response.status === 404) {
          return undefined;
        }
        throw error;
      })
      .then((data: any) => responseMapper(data, request.config.context))
      .then(this.cacheMember)
      .then(action((item?: T) => {
        if (item) item._isLoading = false;
        if (cachedItem) cachedItem._isLoading = false;
        return item;
      }));

    if (cachedItem) {
      cachedItem._promise = promise;
      cachedItem._isLoading = true;
      if (!reload) {
        return Promise.resolve(cachedItem);
      }
    }

    return promise;
  }

  @action add(item: T): Promise<T | undefined> {
    if (!item) throw new Error('AjaxRepository method \'add\' called without item argument');

    const request = this.createRequest(this.addUrl || this.collectionUrl, this.addMethod, item);
    const requestConfigModifier = this.addRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, item);

    const responseMapper = this.addResponseMapper || this.memberResponseMapper;
    return request.fetchJson()
      .then((data: any) => responseMapper(data, request.config.context))
      .then(this.cacheMember);
  }

  @action update(item: T): Promise<T | undefined> {
    if (!item) throw new Error('AjaxRepository method \'update\' called without item argument');

    const request = this.createRequest(this.updateUrl || this.memberUrl, this.updateMethod, item);
    const requestConfigModifier = this.updateRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, item);

    const responseMapper = this.updateResponseMapper || this.memberResponseMapper;
    return request.fetchJson()
      .then((data: any) => responseMapper(data, request.config.context))
      .then(this.cacheMember);
  }

  @action delete(item: T): Promise<any> {
    if (!item) throw new Error('AjaxRepository method \'delete\' called without item argument');

    const request = this.createRequest(this.deleteUrl || this.memberUrl, this.deleteMethod, item);
    const requestConfigModifier = this.deleteRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, item);

    const responseMapper = this.deleteResponseMapper || this.memberResponseMapper;
    return request.fetchJson()
      .then((data: any) => responseMapper(data, request.config.context))
      .then((result: any) => {
        this.uncacheItem(item);
        return result;
      });
  }

  @action deleteAll(options: CollectionOptions = {}): Promise<any> {
    const request = this.createRequest(this.deleteAllUrl || this.collectionUrl, this.deleteAllMethod);
    this.applyCollectionOptionsToRequest(request, options);
    const requestConfigModifier = this.deleteAllRequestConfigModifier || this.collectionRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, options);

    const responseMapper = this.deleteAllResponseMapper || this.collectionResponseMapper;
    return request.fetchJson()
      .then((data: any) => responseMapper(data, request.config.context))
      .then((items: T[]) => {
        items.forEach(this.uncacheItem);
        return items;
      });
  }

  @action reload(item: T): Promise<T | undefined> {
    if (!item.id) {
      throw new Error('Item must have `id` to reload');
    }
    if (!this.modelObjectCache[item.id]) {
      // Cache item so that getById will update this item instead of caching a different instance.
      this.modelObjectCache[item.id] = item;
    }
    return this.getById(item.id, true);
  }

  private cacheList = action((list: List<T>) => {
    list.forEach((item: T, index: number) => {
      list[index] = this.cacheItem(item);
    });
    return list;
  });

  private cacheMember = action((item?: T) => {
    return item ? this.cacheItem(item) : item;
  });

  private cacheItem = action((item: T) => {
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

  private uncacheItem = action((item: T) => {
    const itemId = item[this.idKey] as unknown as Id;
    if (itemId) {
      delete this.modelObjectCache[itemId];
    }
  });

  private applyCollectionOptionsToRequest(request: AjaxRequest, options: CollectionOptions) {
    if (options.filters && Object.keys(options.filters).length) {
      const filterFunction = this.filter;
      if (!filterFunction) throw new Error('AjaxRepository instance has no filter function');
      filterFunction(request.config, options.filters);
    }
    if (options.sort) {
      let sortFunction = this.sort;
      if (!sortFunction) throw new Error('AjaxRepository instance has no sort function');
      sortFunction(request.config, options.sort);
    }
    if (options.search) {
      const searchFunction = this.search;
      if (!searchFunction) throw new Error('AjaxRepository instance has no search function');
      searchFunction(request.config, options.search);
    }
  }

  private createRequest(url?: Url<T>, method?: string, value?: Id | T) {
    if (url && typeof url !== 'string') {
      if (!value) throw new Error('Must provide item for dynamic URL');
      url = url.call(this, value);
    }
    const options = {} as AjaxRequestConfig;
    if (method) {
      options.method = method;
    }
    if (this.requestContext) {
      options.context = this.requestContext();
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
    } else {
      return value[this.idKey];
    }
  }
}

export function listPaginationRequestConfigModifier(
  requestConfig: AjaxRequestConfig,
  options: CollectionOptions,
  pageIndex: number = 0,
) {
  if (options.pageSize) {
    requestConfig.queryParams['pageSize'] = options.pageSize;
    requestConfig.queryParams['startIndex'] = options.pageSize * pageIndex;
  }
}
