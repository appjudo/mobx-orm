// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, extendObservable, observable, runInAction, IObservableArray } from 'mobx';
import lodash from 'lodash';

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
  isReloading: boolean;
  error?: Error;
  metadata?: any;
  reset: () => void;
} 

export default interface ObservableList<T> extends BaseObservableList<T> {
  reload: (this: ObservableList<T>, clear?: boolean) => Promise<List<T>>;
  preload: (this: ObservableList<T>) => Promise<List<T>>;
}

export interface PaginatedObservableList<T> extends BaseObservableList<T | undefined> {
  provider: ListProvider<T>;
  totalLength: number;
  pageIndex: number;
  pageSize: number;
  pages: IObservableArray<List<T> | undefined>;
  pagePromises: IObservableArray<Promise<List<T>> | undefined>;
  loadedPageIndexes: number[];
  loadingPageCount: number;
  isFullyLoaded: boolean;
  _version: number;
  getNextPage: () => Promise<List<T>>;
  getPageAtIndex: (pageIndex: number, clear?: boolean) => Promise<List<T>>;
  getItemAtIndex: (itemIndex: number, clear?: boolean) => T | undefined;
  isItemLoadedAtIndex: (itemIndex: number) => boolean
  reload: (this: PaginatedObservableList<T>, clear?: boolean) => Promise<List<T>>;
  preload: (this: PaginatedObservableList<T>) => Promise<List<T>>;
}

function reset<T>(this: ObservableList<T>) {
  this.replace([]);
}

function preload<T>(this: ObservableList<T>): Promise<List<T>> {
  return this.isLoading ? this.promise : this.reload();
}

function reload<T>(this: ObservableList<T>, clear: boolean = false): Promise<List<T>> {
  return runInAction(() => {
    if (clear) this.replace([]);
    if (this.isLoading) {
      return this.promise;
    }

    this.error = undefined;
    this.promise = this.provider().then(action((data: List<T>) => {
      this.isLoading = false;
      this.isReloading = false;
      this.replace(data || []);
      attachMetadata(this, data);
      return data;
    })).catch(action((error: Error) => {
      this.replace([]);
      this.isLoading = false;
      this.isReloading = false;
      this.error = error;
      throw error;
    }));

    this.isLoading = true;
    this.isReloading = true;
    return this.promise;
  });
}

function paginatedPreload<T>(this: PaginatedObservableList<T>): Promise<List<T | undefined>> {
  return runInAction(() => {
    if (this.pageIndex > 0) {
      return Promise.resolve(this.slice());
    }
    if (this.isLoading) {
      return this.promise;
    }
    return this.getNextPage();
  });
}

function paginatedReset<T>(this: PaginatedObservableList<T>) {
  this.replace([]);
  this.isFullyLoaded = false;
  this.pageIndex = 0;
  this.totalLength = 0;
  this._version++;
}

function paginatedReload<T>(this: PaginatedObservableList<T>, clear?: boolean): Promise<List<T | undefined>> {
  return runInAction(() => {
    if (clear) this.reset();
    if (this.isReloading) return this.promise;

    this.error = undefined;
    return this.getPageAtIndex(0, !clear);
  });
}

function attachMetadata<T>(target: List<T> | PaginatedObservableList<T>, source: List<T>) {
  return runInAction(() => {
    if ('metadata' in source) {
      target.metadata = source.metadata;
    }
    if ('totalLength' in source) {
      target.totalLength = source.totalLength;
    }
    return target;
  });
}

function illegalAccessNoOp() {};

export function getObservableListFromProvider<T>(
  provider: ListProvider<T>,
  initialArray?: List<T>,
): ObservableList<T> {
  const promise = initialArray ? Promise.resolve(initialArray) : provider();
  const list: ObservableList<T> = extendObservable(getObservableArrayObjectHybrid<T>(), {
    isLoading: true,
    isReloading: false,
    provider,
    reset,
    reload,
    preload,
    metadata: undefined,
    promise: promise.then(action((data: List<T>) => {
      list.isLoading = false;
      list.replace(data || []);
      if ('metadata' in data) {
        list.metadata = data.metadata;
      }
      return data;
    })).catch(action((error: Error) => {
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
    return Promise.resolve(attachMetadata([], this) as List<T>);
  }
  return this.getPageAtIndex(this.pageIndex);
}

function getPageAtIndex<T>(this: PaginatedObservableList<T>, pageIndex: number, clear?: boolean): Promise<List<T>> {
  this.error = undefined;

  // Cache these values here as local constants for reliable usage in nested closure scopes.
  const {pageSize} = this;
  let pagePromise = this.pagePromises[pageIndex];
  if (pagePromise) {
    return pagePromise;
  }
  const version = this._version;
  pagePromise = this.provider(pageSize, pageIndex).then(action((data: List<T>) => {
    if (clear) this.reset();

    // Check that list has not been reloaded/reset since page request was made.
    if (version === this._version) {
      const startIndex = pageSize * pageIndex;
      while (this.length < startIndex) {
        this.push(undefined);
      }
      for (let index = 0; index < data.length; index++) {
        this[startIndex + index] = data[index];
      }
      this.loadedPageIndexes.push(pageIndex);
      const pages = this.pages.slice();
      pages[pageIndex] = data;
      this.pages.replace(pages);
      this.pageIndex = Math.max(this.pageIndex, pageIndex + 1);
      attachMetadata(this, data);
      this.loadingPageCount--;
      this.isLoading = !!this.loadingPageCount;
      const totalPageCount = Math.ceil(this.totalLength / pageSize);
      this.isFullyLoaded = this.loadedPageIndexes.length === totalPageCount;
    }
    return data;
  })).catch(action((error: Error) => {
    debugger;
    if (version === this._version) {
      this.loadingPageCount--;
      this.isLoading = !!this.loadingPageCount;
    }
    this.error = error;
    throw error;
  }));
  const pagePromises = this.pagePromises.slice();
  pagePromises[pageIndex] = pagePromise;
  this.pagePromises.replace(pagePromises);
  this.loadingPageCount++;
  this.isLoading = true;

  this.promise = Promise.all([this.promise, pagePromise]).then(() => {
    if (this.loadingPageCount) {
      return this.promise;
    }
    return this.loadedPageIndexes.sort().map((index) => this.pages[index]).flat();
  });

  return pagePromise;
}

function getItemAtIndex<T>(this: PaginatedObservableList<T>, itemIndex: number, clear?: boolean): T | undefined {
  if (this.isItemLoadedAtIndex(itemIndex)) {
    return this[itemIndex];
  }
  const pageIndex = Math.floor(itemIndex / this.pageSize);
  this.getPageAtIndex(pageIndex, clear);
  return undefined;
}

function isItemLoadedAtIndex<T>(this: PaginatedObservableList<T>, itemIndex: number) {
  return this.length > itemIndex && !lodash.isUndefined(this[itemIndex]);
}

export function getPaginatedObservableListFromProvider<T>(
  provider: PaginatedListProvider<T>,
  pageSize: number,
): PaginatedObservableList<T> {
  const pageIndex = 0;
  const list: PaginatedObservableList<T> = extendObservable(getObservableArrayObjectHybrid<T | undefined>(), {
    _version: 1,
    isLoading: true,
    isReloading: false,
    provider,
    reset: paginatedReset,
    reload: paginatedReload,
    preload: paginatedPreload,
    totalLength: 0,
    pageIndex,
    pageSize,
    pages: observable.array(),
    pagePromises: observable.array(),
    loadedPageIndexes: observable.array(),
    loadingPageCount: 0,
    isFullyLoaded: false,
    getNextPage,
    getPageAtIndex,
    getItemAtIndex,
    isItemLoadedAtIndex,
    metadata: undefined,
    promise: provider(pageSize, pageIndex).then(action((data: List<T>) => {
      const startIndex = pageSize * pageIndex;
      while (list.length < startIndex) {
        list.push(undefined);
      }
      for (let index = 0; index < data.length; index++) {
        list[startIndex + index] = data[index];
      }
      list.pageIndex++;
      attachMetadata(list, data);
      list.isLoading = false;
      list.isFullyLoaded = list.length >= list.totalLength;
      return data;
    })).catch(action((error: Error) => {
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
