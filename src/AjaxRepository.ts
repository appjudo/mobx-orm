// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action } from 'mobx';

import AjaxClient from './AjaxClient';
import AjaxRequest, {
  AjaxRequestConfig,
  CollectionRequestConfigModifier,
  CollectionRequestMapper,
  MemberIdRequestConfigModifier,
  MemberIdRequestMapper,
  MemberRequestConfigModifier,
  MemberRequestMapper,
  OptionRequestConfigModifier,
  OptionRequestMapper,
  mergeRequestConfig,
} from './AjaxRequest';

import Model from './Model';
import Repository, { RepositoryContext, RepositoryContextBuilder } from './Repository';
import {
  CollectionOptions,
  CollectionResponseBodyMapper,
  Context,
  DeleteAllResponseBodyMapper,
  Filters,
  Id,
  List,
  MemberResponseBodyMapper,
} from './types';

export interface AjaxRepositoryContext<T extends Model<any>> extends RepositoryContext<T> {
  repository: AjaxRepository<T>;
}

export type AjaxRepositoryContextBuilder<T extends Model<any>> =
  AjaxRepositoryContext<T> | ((repository: AjaxRepository<T>) => any);

export interface CollectionParams<T extends Model<any>> extends CollectionOptions<T> {
  context: AjaxRepositoryContext<T>;
  pageIndex?: number;
}

export interface MemberParams<T extends Model<any>> {
  context: AjaxRepositoryContext<T>;
  member: T;
  memberId: Id;
  values: Partial<T>;
}

export interface MemberIdParams<T extends Model<any>> {
  context: AjaxRepositoryContext<T>;
  member?: T;
  memberId: Id;
}

export type StaticUrl = string;
export type DynamicCollectionUrl<T extends Model<any>> = (params: CollectionParams<T>) => StaticUrl | undefined;
export type CollectionUrl<T extends Model<any>> = StaticUrl | DynamicCollectionUrl<T>;
export type MemberUrl<T extends Model<any>> = (params: MemberParams<T>) => StaticUrl | undefined;
export type MemberIdUrl<T extends Model<any>> = (params: MemberIdParams<T>) => StaticUrl | undefined;

export interface AjaxRepositoryConfig<T extends Model<any>> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl?: CollectionUrl<T>;
  collectionRequestMapper?: CollectionRequestMapper<T>;
  collectionRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  collectionResponseBodyMapper?: CollectionResponseBodyMapper<T>;

  memberBaseUrl?: CollectionUrl<T>;
  memberUrl?: MemberIdUrl<T>;
  memberRequestMapper?: MemberRequestMapper<T>;
  memberRequestConfigModifier?: MemberRequestConfigModifier<T>;
  memberResponseBodyMapper?: MemberResponseBodyMapper<T>;

  listMethod?: string;
  listUrl?: CollectionUrl<T>;
  listRequestMapper?: CollectionRequestMapper<T>;
  listRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  listResponseBodyMapper?: CollectionResponseBodyMapper<T>;

  getByIdMethod?: string;
  getByIdUrl?: MemberIdUrl<T>;
  getByIdRequestMapper?: MemberIdRequestMapper<T>;
  getByIdRequestConfigModifier?: MemberIdRequestConfigModifier<T>;
  getByIdResponseBodyMapper?: MemberResponseBodyMapper<T>;

  addMethod?: string;
  addUrl?: CollectionUrl<T>;
  addRequestMapper?: MemberRequestMapper<T>;
  addRequestConfigModifier?: MemberRequestConfigModifier<T>;
  addResponseBodyMapper?: MemberResponseBodyMapper<T>;

  updateMethod?: string;
  updateUrl?: MemberUrl<T>;
  updateRequestMapper?: MemberRequestMapper<T>;
  updateRequestConfigModifier?: MemberRequestConfigModifier<any>;
  updateResponseBodyMapper?: MemberResponseBodyMapper<T>;

  deleteMethod?: string;
  deleteUrl?: MemberUrl<T>;
  deleteRequestMapper?: MemberRequestMapper<T>;
  deleteRequestConfigModifier?: MemberRequestConfigModifier<T>;
  deleteResponseBodyMapper?: MemberResponseBodyMapper<any>;

  deleteAllMethod?: string;
  deleteAllUrl?: CollectionUrl<T>;
  deleteAllRequestMapper?: CollectionRequestMapper<T>;
  deleteAllRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  deleteAllResponseBodyMapper?: DeleteAllResponseBodyMapper<any>;

  sortRequestMapper?: OptionRequestMapper<string>;
  searchRequestMapper?: OptionRequestMapper<string>;
  filterRequestMapper?: OptionRequestMapper<Filters>;

  sortRequestConfigModifier?: OptionRequestConfigModifier<string>;
  searchRequestConfigModifier?: OptionRequestConfigModifier<string>;
  filterRequestConfigModifier?: OptionRequestConfigModifier<Filters>;

  context?: AjaxRepositoryContextBuilder<T>;
}

export default class AjaxRepository<T extends Model<any>> extends Repository<T> {
  client?: AjaxClient;
  baseUrl?: string;

  collectionUrl: CollectionUrl<T> = '';
  collectionRequestMapper?: CollectionRequestMapper<T>;
  collectionRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  collectionResponseBodyMapper: CollectionResponseBodyMapper<T> = (data: any) => data;

  memberBaseUrl: CollectionUrl<T> = function memberBaseUrl(params) {
    const {repository} = params.context;
    return repository.evaluateCollectionUrl(repository.collectionUrl, params);
  };
  memberUrl: MemberIdUrl<T> = function memberUrl(params) {
    const {memberId, context} = params;
    const {memberBaseUrl} = context.repository;
    const baseUrl = typeof memberBaseUrl === 'string' ? memberBaseUrl : memberBaseUrl(params);
    return `${baseUrl}/${memberId}`;
  };
  memberRequestMapper?: MemberRequestMapper<T>;
  memberRequestConfigModifier?: MemberRequestConfigModifier<T>;
  memberResponseBodyMapper: MemberResponseBodyMapper<T> = (data: any) => data;

  listMethod: string = 'GET';
  listUrl?: CollectionUrl<T>;
  listRequestMapper?: CollectionRequestMapper<T>;
  listRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  listResponseBodyMapper?: CollectionResponseBodyMapper<T>;

  getByIdMethod: string = 'GET';
  getByIdUrl?: MemberIdUrl<T>;
  getByIdRequestMapper?: MemberIdRequestMapper<T>;
  getByIdRequestConfigModifier?: MemberIdRequestConfigModifier<T>;
  getByIdResponseBodyMapper?: MemberResponseBodyMapper<T>;

  addMethod: string = 'POST';
  addUrl?: CollectionUrl<T>;
  addRequestMapper?: MemberRequestMapper<T>;
  addRequestConfigModifier?: MemberRequestConfigModifier<T>;
  addResponseBodyMapper?: MemberResponseBodyMapper<T>;

  updateMethod: string = 'PATCH';
  updateUrl?: MemberUrl<T>;
  updateRequestMapper?: MemberRequestMapper<T>;
  updateRequestConfigModifier?: MemberRequestConfigModifier<T>;
  updateResponseBodyMapper?: MemberResponseBodyMapper<T>;

  deleteMethod: string = 'DELETE';
  deleteUrl?: MemberUrl<T>;
  deleteRequestMapper?: MemberRequestMapper<T>;
  deleteRequestConfigModifier?: MemberRequestConfigModifier<T>;
  deleteResponseBodyMapper?: MemberResponseBodyMapper<T>;

  deleteAllMethod: string = 'DELETE';
  deleteAllUrl?: CollectionUrl<T>;
  deleteAllRequestMapper?: CollectionRequestMapper<T>;
  deleteAllRequestConfigModifier?: CollectionRequestConfigModifier<T>;
  deleteAllResponseBodyMapper?: DeleteAllResponseBodyMapper<T>;

  sortRequestMapper?: OptionRequestMapper<string>;
  searchRequestMapper?: OptionRequestMapper<string>;
  filterRequestMapper?: OptionRequestMapper<Filters>;

  sortRequestConfigModifier?: OptionRequestConfigModifier<string>;
  searchRequestConfigModifier?: OptionRequestConfigModifier<string>;
  filterRequestConfigModifier?: OptionRequestConfigModifier<Filters>;

  context?: RepositoryContextBuilder<T>;

  modelObjectCache: Record<Id, T>;

  constructor(config: AjaxRepositoryConfig<T>) {
    super();
    Object.assign(this, config);
    this.modelObjectCache = {};
  }

  @action list(options: CollectionOptions<T> = {}, pageIndex?: number): Promise<List<T>> {
    const params = this.getCollectionParams(options, pageIndex);
    const url = this.evaluateCollectionUrl(this.listUrl || this.collectionUrl, params);
    const request = this.createRequest(url, this.listMethod, params.context);
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

  @action async getById(id: string, reload: boolean = false, context: Context<T> = {}): Promise<T | undefined> {
    if (!id) throw new Error('AjaxRepository method `getById` called without id argument');

    const cachedItem = this.modelObjectCache[id];
    if (cachedItem) {
      if (cachedItem._orm.isLoading) {
        return cachedItem._orm.loadingPromise!;
      }
      if (cachedItem.isFullyLoaded && !reload) {
        return Promise.resolve(cachedItem);
      }
    }

    const params = this.getMemberIdParams(id, context);
    const url = this.evaluateMemberIdUrl(this.getByIdUrl || this.memberUrl, params);
    const request = this.createRequest(url, this.getByIdMethod, params.context);
    if (this.getByIdRequestMapper) mergeRequestConfig(request.config, this.getByIdRequestMapper(params));
    this.getByIdRequestConfigModifier?.(request.config, params);

    const responseBodyMapper = this.getByIdResponseBodyMapper || this.memberResponseBodyMapper;
    const promise = request.fetchJson()
      .catch((error: any) => {
        if (error.response && error.response.status === 404) {
          return undefined;
        }
        throw error;
      })
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember);

    if (cachedItem) {
      cachedItem._orm.loadingPromise = promise;
      cachedItem._orm.isLoading = cachedItem._orm.isReloading = true;
    }
    const item = await promise;
    if (item) item._orm.isLoading = item._orm.isReloading = false;
    if (cachedItem) cachedItem._orm.isLoading = cachedItem._orm.isReloading = false;
    return item;
  }

  @action async add(member: T, context?: Context<T>): Promise<T | undefined> {
    if (!member) throw new Error('AjaxRepository method `add` called without item argument');

    const params = this.getMemberParams(member, context);
    const url = this.evaluateCollectionUrl(this.addUrl || this.collectionUrl, params);
    const request = this.createRequest(url, this.addMethod, params.context);

    const requestMapper = this.addRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(params));

    const requestConfigModifier = this.addRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, params);

    const responseBodyMapper = this.addResponseBodyMapper || this.memberResponseBodyMapper;
    member._orm.savingPromise = request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember);
    member._orm.isSaving = true;
    const result = await member._orm.savingPromise;
    if (result?.[this.idKey] && !member[this.idKey]) {
      member[this.idKey] = result[this.idKey];
    }
    member._orm.isSaving = false;
    return result;
  }

  @action async update(member: T, values?: Partial<T>, context?: Context<T>): Promise<T | undefined> {
    if (!member) throw new Error('AjaxRepository method `delete` called without item argument');

    const id = member[this.idKey] as unknown as string;
    if (!id) throw new Error(`AjaxRepository method \`update\` requires \`${this.idKey}\` to be set already`);

    const params = this.getMemberParams(member, context, values || member);
    const url = this.evaluateMemberUrl(this.updateUrl || this.memberUrl, params);
    const request = this.createRequest(url, this.updateMethod, params.context);

    const requestMapper = this.updateRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(params));

    const requestConfigModifier = this.updateRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, params);

    const responseBodyMapper = this.updateResponseBodyMapper || this.memberResponseBodyMapper;
    member._orm.savingPromise = request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then(this.cacheMember);
    member._orm.isSaving = true;
    const result = await member._orm.savingPromise;
    if (values) Object.assign(member, values);
    member._orm.isSaving = false;
    return result;
  }

  @action delete(member: T, context?: Context<T>): Promise<any> {
    if (!member) throw new Error('AjaxRepository method `delete` called without item argument');

    const params = this.getMemberParams(member, context);
    const url = this.evaluateMemberUrl(this.deleteUrl || this.memberUrl, params);
    const request = this.createRequest(url, this.deleteMethod, params.context);

    const requestMapper = this.deleteRequestMapper || this.memberRequestMapper;
    if (requestMapper) mergeRequestConfig(request.config, requestMapper(params));

    const requestConfigModifier = this.deleteRequestConfigModifier || this.memberRequestConfigModifier;
    if (requestConfigModifier) requestConfigModifier(request.config, params);

    const responseBodyMapper = this.deleteResponseBodyMapper || this.memberResponseBodyMapper;
    return request.fetchJson()
      .then((data: any) => responseBodyMapper(data, request.config.context))
      .then((result: any) => {
        this.uncacheItem(member);
        return result;
      });
  }

  @action deleteAll(options: CollectionOptions<T> = {}): Promise<any> {
    const params = this.getCollectionParams(options);
    const url = this.evaluateCollectionUrl(this.deleteAllUrl || this.collectionUrl, params);
    const request = this.createRequest(url, this.deleteAllMethod, params.context);
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

  @action async reload(item: T, context?: Context<T>): Promise<T | undefined> {
    if (!item) throw new Error('AjaxRepository method `delete` called without item argument');

    const itemId = item[this.idKey] as unknown as string;
    if (!itemId) {
      throw new Error(`Item must have \`${this.idKey}\` to reload`);
    }
    if (!this.modelObjectCache[itemId]) {
      // Cache item so that getById will update this item instead of caching a different instance.
      this.modelObjectCache[itemId] = item;
    }
    item._orm.loadingPromise = this.getById(itemId, true, context);
    item._orm.isLoading = item._orm.isReloading = true;
    const result = await item._orm.loadingPromise;
    item._orm.isLoading = item._orm.isReloading = false;
    return result;
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
      if (!this.filterRequestMapper && !this.filterRequestConfigModifier) {
        throw new Error('AjaxRepository instance has no filter capability');
      }
      if (this.filterRequestMapper) {
        mergeRequestConfig(request.config, this.filterRequestMapper(options.filters));
      }
      if (this.filterRequestConfigModifier) {
        this.filterRequestConfigModifier(request.config, options.filters);
      }
    }
    if (options.sort) {
      if (!this.sortRequestMapper && !this.sortRequestConfigModifier) {
        throw new Error('AjaxRepository instance has no sort capability');
      }
      if (this.sortRequestMapper) {
        mergeRequestConfig(request.config, this.sortRequestMapper(options.sort));
      }
      if (this.sortRequestConfigModifier) {
        this.sortRequestConfigModifier(request.config, options.sort);
      }
    }
    if (options.search) {
      if (!this.searchRequestMapper && !this.searchRequestConfigModifier) {
        throw new Error('AjaxRepository instance has no search capability');
      }
      if (this.searchRequestMapper) {
        mergeRequestConfig(request.config, this.searchRequestMapper(options.search));
      }
      if (this.searchRequestConfigModifier) {
        this.searchRequestConfigModifier(request.config, options.search);
      }
    }
  }

  protected mergeContext(context?: Context<T>): AjaxRepositoryContext<T> {
    return {
      ...(typeof this.context === 'function' ? this.context(this) : this.context),
      ...context,
      repository: this,
    };
  }

  protected getCollectionParams(options: CollectionOptions<T>, pageIndex?: number): CollectionParams<T> {
    const mergedContext = this.mergeContext(options.context);
    return {...options, pageIndex, context: mergedContext};
  }

  protected getMemberParams(member: T, context?: Context<T>, values?: Partial<T>): MemberParams<T> {
    if (!values) values = member;
    const mergedContext = this.mergeContext(context);
    const memberId = member[this.idKey] as unknown as Id;
    return {member, memberId, values, context: mergedContext};
  }

  protected getMemberIdParams(memberId: Id, context?: Context<T>): MemberIdParams<T> {
    const mergedContext = this.mergeContext(context);
    const member = this.modelObjectCache[memberId];
    return {context: mergedContext, member, memberId};
  }

  // eslint-disable-next-line class-methods-use-this
  protected evaluateCollectionUrl(url: CollectionUrl<T>, params: CollectionParams<T>) {
    return typeof url === 'function' ? url(params) : url;
  }

  // eslint-disable-next-line class-methods-use-this
  protected evaluateMemberUrl(url: MemberUrl<T>, params: MemberParams<T>) {
    return typeof url === 'function' ? url(params) : url;
  }

  // eslint-disable-next-line class-methods-use-this
  protected evaluateMemberIdUrl(url: MemberIdUrl<T>, params: MemberIdParams<T>) {
    return typeof url === 'function' ? url(params) : url;
  }

  protected createRequest(url?: StaticUrl, method?: string, context?: AjaxRepositoryContext<T>) {
    const mergedContext = this.mergeContext(context);

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
