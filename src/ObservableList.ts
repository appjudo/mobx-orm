// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action, extendObservable, observable, IObservableArray } from 'mobx';

export interface List<T> extends Array<T> {
  metadata?: any;
  totalLength?: any;
}

type ListProvider<T> = (...args: number[]) => Promise<List<T>>;
type PaginatedListProvider<T> = (pageSize: number, pageIndex?: number) => Promise<List<T>>;

export interface BaseObservableList<T> extends IObservableArray<T> {
  provider: ListProvider<T>;
  promise: Promise<List<T>>;
  isLoading: boolean;
  error?: Error;
  metadata?: any;
} 

export default interface ObservableList<T> extends BaseObservableList<T> {
  reload: (this: ObservableList<T>, clear?: boolean) => Promise<List<T>>;
  preload: (this: ObservableList<T>) => Promise<List<T>>;
}

export interface PaginatedObservableList<T> extends BaseObservableList<T> {
  totalLength: number;
  pageIndex: number;
  pageSize: number;
  isFullyLoaded: boolean;
  getNextPage: () => Promise<List<T>>;
  reload: (this: PaginatedObservableList<T>) => Promise<List<T>>;
  preload: (this: PaginatedObservableList<T>) => Promise<List<T>>;
}

function preload<T>(this: ObservableList<T>): Promise<List<T>> {
  if (this.isLoading) {
    return this.promise;
  }
  return this.reload();
}

function reload<T>(this: ObservableList<T>, clear: boolean = false): Promise<List<T>> {
  if (clear) this.replace([]);
  if (this.isLoading) {
    return this.promise;
  }
  this.error = undefined;
  this.promise = this.provider().then(action((data: List<T>) => {
    this.isLoading = false;
    this.replace(data || []);
    if ('metadata' in data) {
      this.metadata = data.metadata;
    }
    return data;
  })).catch(action((error: Error) => {
    // debugger;
    this.replace([]);
    this.isLoading = false;
    this.error = error;
    throw error;
  }));
  this.isLoading = true;
  return this.promise;
}

function paginatedPreload<T>(this: PaginatedObservableList<T>): Promise<List<T>> {
  if (this.pageIndex > 0) {
    return Promise.resolve(this.slice());
  }
  if (this.isLoading) {
    return this.promise;
  }
  return this.getNextPage();
}

function paginatedReload<T>(this: PaginatedObservableList<T>): Promise<List<T>> {
  this.replace([]);
  this.isFullyLoaded = false;
  this.pageIndex = 0;
  this.totalLength = 0;
  this.isLoading = false;
  return this.getNextPage();
}

function attachMetadata<T>(target: List<T> | PaginatedObservableList<T>, source: List<T>) {
  if ('metadata' in source) {
    target.metadata = source.metadata;
  }
  if ('totalLength' in source) {
    target.totalLength = source.totalLength;
  }
  return target;
}

function illegalAccessNoOp() {};

export function getObservableListFromProvider<T>(provider: ListProvider<T>): ObservableList<T> {
  const list: ObservableList<T> = extendObservable(getObservableArrayObjectHybrid<T>(), {
    isLoading: true,
    provider,
    reload,
    preload,
    promise: provider().then(action((data: List<T>) => {
      list.isLoading = false;
      list.replace(data || []);
      if ('metadata' in data) {
        list.metadata = data.metadata;
      }
      return data;
    })).catch(action((error: Error) => {
      // debugger;
      list.replace([]);
      list.isLoading = false;
      list.error = error;
      throw error;
    }))
  }, {
    preload: action,
    reload: action,
  });
  return list;
}

function getNextPage<T>(this: PaginatedObservableList<T>): Promise<List<T>> {
  if (this.isFullyLoaded) {
    return Promise.resolve(attachMetadata([], this));
  }
  this.error = undefined;
  if (this.isLoading) {
    return this.promise;
  }
  // Cache these values here as local constants for reliable usage in nested closure scopes.
  const {pageSize, pageIndex} = this;
  this.promise = this.provider(pageSize, pageIndex).then(action((data: List<T>) => {
    const startIndex = pageSize * pageIndex;
    for (let index = 0; index < data.length; index++) {
      this[startIndex + index] = data[index];
    }
    this.pageIndex++;
    attachMetadata(this, data);
    this.isLoading = false;
    this.isFullyLoaded = this.length >= this.totalLength;
    return data;
  })).catch(action((error: Error) => {
    // debugger;
    this.isLoading = false;
    this.error = error;
    throw error;
  }));
  this.isLoading = true;
  return this.promise;
}

export function getPaginatedObservableListFromProvider<T>(
  provider: PaginatedListProvider<T>,
  pageSize: number,
): PaginatedObservableList<T> {
  const pageIndex = 0;
  const list: PaginatedObservableList<T> = extendObservable(getObservableArrayObjectHybrid<T>(), {
    isLoading: true,
    provider,
    reload: paginatedReload,
    preload: paginatedPreload,
    totalLength: 0,
    pageIndex,
    pageSize,
    isFullyLoaded: false,
    getNextPage,
    promise: provider(pageSize, pageIndex).then(action((data: List<T>) => {
      const startIndex = pageSize * pageIndex;
      for (let index = 0; index < data.length; index++) {
        list[startIndex + index] = data[index];
      }
      list.pageIndex++;
      attachMetadata(list, data);
      list.isLoading = false;
      list.isFullyLoaded = list.length >= list.totalLength;
      return data;
    })).catch(action((error: Error) => {
      // debugger;
      list.isLoading = false;
      list.error = error;
      throw error;
    })),
  }, {
    getNextPage: action,
    preload: action,
    reload: action,
  }) as PaginatedObservableList<T>;

  return list;
}

export function getObservableListFromArray<T>(sourceArray: List<T> = []): ObservableList<T> {
  return getObservableListFromProvider(() => Promise.resolve(sourceArray));
}

export function getPaginatedObservableListFromArray<T>(
  sourceArray: List<T> = [],
  pageSize: number,
): PaginatedObservableList<T> {
  const provider = (pageSize: number, pageIndex: number = 0) => {
    const startIndex = pageIndex * pageSize;
    const result: List<T> = sourceArray.slice(startIndex, pageSize);
    attachMetadata(result, sourceArray);
    return Promise.resolve(result);
  };
  return getPaginatedObservableListFromProvider(provider, pageSize);
}

function getObservableArrayObjectHybrid<T>(sourceArray?: List<T>): IObservableArray<T> {
  const obj: any = observable({});
  const arr: any = observable.array(sourceArray);
  arr['$mobx'].read = obj['$mobx'].read;
  arr['$mobx'].write = obj['$mobx'].write;
  arr['$mobx'].illegalAccess = illegalAccessNoOp;
  return arr;
}
